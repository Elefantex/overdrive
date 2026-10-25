// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
#include "pkg_proxy.hpp"
#include "network.hpp"
#include "thread_name.hpp"
#include "worker_thread.hpp"
#include <arpa/inet.h>
#include <atomic>
#include <cctype>
#include <cerrno>
#include <chrono>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <curl/curl.h>
#include <list>
#include <map>
#include <memory>
#include <mutex>
#include <netinet/in.h>
#include <poll.h>
#include <random>
#include <sys/socket.h>
#include <unistd.h>

namespace pkg_proxy {
namespace {
#ifdef MSG_NOSIGNAL
constexpr int kSendFlags = MSG_NOSIGNAL;
#else
constexpr int kSendFlags = 0;
#endif
// The console's queue opens a few connections per package; more than this is not the console.
constexpr unsigned kMaxConnections = 16;
// A request line and its headers; the console's are a few hundred bytes.
constexpr std::size_t kMaxRequest = 8192;
// The first requests of each link are logged, so app.log shows how the console asks; the rest are not.
constexpr unsigned kLoggedRequests = 6;

struct Link { std::string url; std::uint64_t total = 0; unsigned requests = 0; };
struct Connection {
  int fd = -1;
  std::atomic<bool> done{false};
  WorkerThread thread;
};

std::mutex mutex;
std::map<std::string, Link> links;
std::list<std::unique_ptr<Connection>> connections;
WorkerThread acceptor;
int listener = -1;
std::uint16_t port = 0;
std::atomic<bool> stopping{false};

void log(const std::string& line) { network::platform_log(("pkg-proxy: " + line).c_str()); }

bool send_all(int fd, const char* data, std::size_t size) {
  while (size) {
    const auto count = send(fd, data, size, kSendFlags);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return false;
    data += count;
    size -= static_cast<std::size_t>(count);
  }
  return true;
}

bool reply(int fd, int status, const char* reason) {
  char head[160];
  const int size = std::snprintf(head, sizeof head, "HTTP/1.1 %d %s\r\nContent-Length: 0\r\nConnection: close\r\n\r\n", status, reason);
  return send_all(fd, head, static_cast<std::size_t>(size));
}

// The request line and headers, up to the blank line; false when the client hangs up or sends too much.
bool read_request(int fd, std::string& out) {
  char buffer[1024];
  while (out.find("\r\n\r\n") == std::string::npos) {
    pollfd ready{fd, POLLIN, 0};
    if (stopping || poll(&ready, 1, 10000) <= 0) return false;
    const auto count = recv(fd, buffer, sizeof buffer, 0);
    if (count <= 0 || out.size() + static_cast<std::size_t>(count) > kMaxRequest) return false;
    out.append(buffer, static_cast<std::size_t>(count));
  }
  return true;
}

// The value of `name` (lower case) among the request's headers, empty when it has none.
std::string header(const std::string& request, const char* name) {
  std::size_t at = request.find("\r\n");
  while (at != std::string::npos && at + 2 < request.size()) {
    const auto start = at + 2, end = request.find("\r\n", start);
    const auto colon = request.find(':', start);
    if (end == std::string::npos || end == start) break;
    if (colon != std::string::npos && colon < end) {
      std::string key = request.substr(start, colon - start);
      for (auto& c : key) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
      if (key == name) {
        auto value = request.substr(colon + 1, end - colon - 1);
        while (!value.empty() && value.front() == ' ') value.erase(0, 1);
        return value;
      }
    }
    at = end;
  }
  return {};
}

// "bytes=<first>-<last>" or "bytes=<first>-": one range inside the file. Several ranges or a suffix
// range ("bytes=-500") are answered with the whole file, which HTTP allows.
bool parse_range(const std::string& value, std::uint64_t total, std::uint64_t& first, std::uint64_t& last) {
  unsigned long long a = 0, b = 0;
  char tail = 0;
  if (std::sscanf(value.c_str(), "bytes=%llu-%llu%c", &a, &b, &tail) == 2) { first = a; last = b; }
  else if (std::sscanf(value.c_str(), "bytes=%llu-%c", &a, &tail) == 1) { first = a; last = total - 1; }
  else return false;
  if (last >= total) last = total - 1;
  return first <= last;
}

struct Forward {
  int fd = -1;
  CURL* curl = nullptr;
  std::string head;     // sent before the first body byte, once the origin answered as expected
  bool ranged = false, started = false, refused = false;
  long status = 0;
};

std::size_t forward_body(char* data, std::size_t size, std::size_t count, void* user) {
  auto& f = *static_cast<Forward*>(user);
  if (!f.started) {
    curl_easy_getinfo(f.curl, CURLINFO_RESPONSE_CODE, &f.status);
    // The origin is always asked for a range; a 200 is the whole file, right only when that is what
    // the console asked for, and anything else would hand it the wrong bytes.
    if (f.status != 206 && !(f.status == 200 && !f.ranged)) { f.refused = true; return 0; }
    if (!send_all(f.fd, f.head.data(), f.head.size())) return 0;
    f.started = true;
  }
  if (stopping || !send_all(f.fd, data, size * count)) return 0;
  return size * count;
}

void serve_connection(Connection& connection) {
  name_thread("pkg-proxy");
  const int fd = connection.fd;
  std::string request;
  if (!read_request(fd, request)) return;
  const auto line_end = request.find("\r\n");
  const auto first_space = request.find(' ');
  const auto second_space = first_space == std::string::npos ? std::string::npos : request.find(' ', first_space + 1);
  if (second_space == std::string::npos || second_space > line_end) { reply(fd, 400, "Bad Request"); return; }
  const std::string method = request.substr(0, first_space);
  const std::string path = request.substr(first_space + 1, second_space - first_space - 1);
  // "/<token>/<file>.pkg"
  const auto slash = path.find('/', 1);
  const std::string token = path.size() > 1 && slash != std::string::npos ? path.substr(1, slash - 1) : std::string();
  Link link;
  unsigned seen = 0;
  {
    std::lock_guard lock(mutex);
    const auto found = links.find(token);
    if (found != links.end()) { seen = ++found->second.requests; link = found->second; }
  }
  const std::string range = header(request, "range");
  if (seen && seen <= kLoggedRequests) log(token + " request " + std::to_string(seen) + ": " + method + (range.empty() ? "" : " " + range));
  if (!seen) { reply(fd, 404, "Not Found"); return; }
  if (method != "GET" && method != "HEAD") { reply(fd, 405, "Method Not Allowed"); return; }

  std::uint64_t first = 0, last = link.total - 1;
  const bool ranged = !range.empty() && parse_range(range, link.total, first, last);
  if (!range.empty() && !ranged && range.find(',') == std::string::npos && range.find("=-") == std::string::npos) {
    char head[200];
    const int size = std::snprintf(head, sizeof head, "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */%llu\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                                   static_cast<unsigned long long>(link.total));
    send_all(fd, head, static_cast<std::size_t>(size));
    return;
  }
  char head[400];
  const int head_size = ranged
    ? std::snprintf(head, sizeof head, "HTTP/1.1 206 Partial Content\r\nContent-Type: application/octet-stream\r\nAccept-Ranges: bytes\r\n"
                    "Content-Range: bytes %llu-%llu/%llu\r\nContent-Length: %llu\r\nConnection: close\r\n\r\n",
                    static_cast<unsigned long long>(first), static_cast<unsigned long long>(last),
                    static_cast<unsigned long long>(link.total), static_cast<unsigned long long>(last - first + 1))
    : std::snprintf(head, sizeof head, "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nAccept-Ranges: bytes\r\n"
                    "Content-Length: %llu\r\nConnection: close\r\n\r\n", static_cast<unsigned long long>(link.total));
  // The HEAD the origin would refuse is answered here, from the size the app read with a GET.
  if (method == "HEAD") { send_all(fd, head, static_cast<std::size_t>(head_size)); return; }

  CURL* curl = curl_easy_init();
  if (!curl) { reply(fd, 503, "Service Unavailable"); return; }
  Forward forward;
  forward.fd = fd;
  forward.curl = curl;
  forward.head.assign(head, static_cast<std::size_t>(head_size));
  forward.ranged = ranged;
  char span[64];
  std::snprintf(span, sizeof span, "%llu-%llu", static_cast<unsigned long long>(first), static_cast<unsigned long long>(last));
  bool ok = network::configure_transport(curl, link.url, true);
  ok = ok && curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, forward_body) == CURLE_OK;
  ok = ok && curl_easy_setopt(curl, CURLOPT_WRITEDATA, &forward) == CURLE_OK;
  // Asked as a range even for the whole file: an origin that answers 200 to it is caught above.
  ok = ok && curl_easy_setopt(curl, CURLOPT_RANGE, span) == CURLE_OK;
  // An origin that has gone quiet does not hold the app's exit for the 30 s of the low-speed limit.
  ok = ok && curl_easy_setopt(curl, CURLOPT_NOPROGRESS, 0L) == CURLE_OK;
  ok = ok && curl_easy_setopt(curl, CURLOPT_XFERINFOFUNCTION, +[](void*, curl_off_t, curl_off_t, curl_off_t, curl_off_t) -> int { return stopping ? 1 : 0; }) == CURLE_OK;
  const CURLcode result = ok ? curl_easy_perform(curl) : CURLE_FAILED_INIT;
  curl_easy_cleanup(curl);
  if (forward.started) {
    if (result != CURLE_OK && !stopping && seen <= kLoggedRequests) log(token + " request " + std::to_string(seen) + " ended early: " + curl_easy_strerror(result));
    return;
  }
  // Nothing went to the console yet: it hears what the origin said, so its own error names it.
  if (forward.refused || forward.status >= 400) {
    log(token + " request " + std::to_string(seen) + ": the origin answered HTTP " + std::to_string(forward.status));
    if (forward.status == 403) reply(fd, 403, "Forbidden");
    else if (forward.status == 404 || forward.status == 410) reply(fd, 404, "Not Found");
    else reply(fd, 502, "Bad Gateway");
    return;
  }
  log(token + " request " + std::to_string(seen) + " failed: " + curl_easy_strerror(result));
  reply(fd, 502, "Bad Gateway");
}

// Joins the connections that have finished; the caller holds `mutex`.
void reap() {
  for (auto it = connections.begin(); it != connections.end();) {
    if ((*it)->done) { (*it)->thread.join(); it = connections.erase(it); }
    else ++it;
  }
}

void accept_loop() {
  name_thread("pkg-proxy-accept");
  while (!stopping) {
    pollfd ready{listener, POLLIN, 0};
    if (poll(&ready, 1, 250) <= 0) continue;
    const int fd = accept(listener, nullptr, nullptr);
    if (fd < 0) continue;
#ifdef SO_NOSIGPIPE
    const int on = 1;
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &on, sizeof on);
#endif
    std::lock_guard lock(mutex);
    reap();
    if (stopping || connections.size() >= kMaxConnections) { reply(fd, 503, "Service Unavailable"); close(fd); continue; }
    auto connection = std::make_unique<Connection>();
    connection->fd = fd;
    Connection* raw = connection.get();
    // TLS to the origin and libcurl's resolver want more than the console's small default stack.
    if (!raw->thread.start([raw] { serve_connection(*raw); shutdown(raw->fd, SHUT_RDWR); close(raw->fd); raw->done = true; }, 1024 * 1024)) {
      reply(fd, 503, "Service Unavailable");
      close(fd);
      continue;
    }
    connections.push_back(std::move(connection));
  }
}

// Binds 127.0.0.1 on a port the system picks; the caller holds `mutex`.
bool listen_locally(std::string& error) {
  if (listener >= 0) return true;
  const int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) { error = std::string("socket: ") + std::strerror(errno); return false; }
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  address.sin_port = 0;
  socklen_t length = sizeof address;
  if (bind(fd, reinterpret_cast<sockaddr*>(&address), sizeof address) != 0 || listen(fd, 16) != 0 ||
      getsockname(fd, reinterpret_cast<sockaddr*>(&address), &length) != 0) {
    error = std::string("listen on 127.0.0.1: ") + std::strerror(errno);
    close(fd);
    return false;
  }
  listener = fd;
  port = ntohs(address.sin_port);
  stopping = false;
  if (!acceptor.start(accept_loop, 256 * 1024)) {
    error = "Cannot start the proxy thread.";
    close(fd);
    listener = -1;
    return false;
  }
  log("listening on 127.0.0.1:" + std::to_string(port));
  return true;
}

// A name the console shows and its parser reads: letters, digits, dot, dash, underscore.
std::string plain(const std::string& file) {
  std::string out;
  for (char c : file) out.push_back((std::isalnum(static_cast<unsigned char>(c)) || c == '.' || c == '-' || c == '_') ? c : '-');
  if (out.size() > 80) out.resize(80);
  if (out.empty()) out = "package";
  if (out.size() < 4 || out.compare(out.size() - 4, 4, ".pkg")) out += ".pkg";
  return out;
}
}

std::string serve(std::string url, std::uint64_t total, std::string file, std::string& error) {
  if (!total) { error = "the package size is unknown"; return {}; }
  std::lock_guard lock(mutex);
  if (!listen_locally(error)) return {};
  // Seeded from the clock, as the download retries are: std::random_device may need a device the
  // console's sandbox does not open, and the link is reachable from this console only.
  static std::mt19937_64 random{static_cast<std::uint64_t>(std::chrono::steady_clock::now().time_since_epoch().count()) ^
                                static_cast<std::uint64_t>(reinterpret_cast<std::uintptr_t>(&links))};
  char token[17];
  std::snprintf(token, sizeof token, "%016llx", static_cast<unsigned long long>(random()));
  links[token] = {std::move(url), total, 0};
  return "http://127.0.0.1:" + std::to_string(port) + "/" + token + "/" + plain(file);
}

void stop() {
  {
    std::lock_guard lock(mutex);
    if (listener < 0) return;
    stopping = true;
    for (auto& connection : connections) if (!connection->done) shutdown(connection->fd, SHUT_RDWR);
  }
  acceptor.join();
  std::lock_guard lock(mutex);
  for (auto& connection : connections) connection->thread.join();
  connections.clear();
  close(listener);
  listener = -1;
  links.clear();
}
}
