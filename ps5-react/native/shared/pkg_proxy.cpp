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
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <curl/curl.h>
#include <list>
#include <map>
#include <memory>
#include <mutex>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>
#ifdef __APPLE__
#include <stdlib.h>
#else
#include <openssl/rand.h>
#endif

namespace pkg_proxy {
namespace {
using Clock = std::chrono::steady_clock;
#ifdef MSG_NOSIGNAL
constexpr int kSendFlags = MSG_NOSIGNAL;
#else
constexpr int kSendFlags = 0;
#endif
// The console's queue opens a few connections per package; past this it is asked to come back.
constexpr unsigned kMaxConnections = 16;
// A request line and its headers; the console's are a few hundred bytes.
constexpr std::size_t kMaxRequest = 8192;
// The first requests of each link are logged, so app.log shows how the console asks; the rest are not.
constexpr unsigned kLoggedRequests = 6;

struct Link {
  std::string url;
  std::uint64_t total = 0;
  std::atomic<std::uint64_t> delivered{0};
  std::atomic<unsigned> requests{0};
  std::atomic<std::int64_t> last{0};  // Clock ticks of the last request
};
struct Connection {
  int fd = -1;
  std::atomic<bool> done{false};
  WorkerThread thread;
};

std::mutex mutex;
std::map<std::string, std::shared_ptr<Link>> links;
std::list<std::unique_ptr<Connection>> connections;
WorkerThread acceptor;
int listener = -1;
std::uint16_t port = 0;
std::atomic<bool> stopping{false};

std::int64_t ticks() { return Clock::now().time_since_epoch().count(); }

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

// Every answer carries what the console's downloader expects of a package origin.
constexpr const char* kCommon = "Accept-Ranges: bytes\r\nCache-Control: no-store\r\nConnection: close\r\n";

bool reply(int fd, int status, const char* reason, const char* extra = "") {
  char head[300];
  const int size = std::snprintf(head, sizeof head, "HTTP/1.1 %d %s\r\n%s%sContent-Length: 0\r\n\r\n", status, reason, kCommon, extra);
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
  Link* link = nullptr;
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
  f.link->delivered += size * count;
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
  std::shared_ptr<Link> link;
  {
    std::lock_guard lock(mutex);
    const auto found = links.find(token);
    if (found != links.end()) link = found->second;
  }
  if (!link) { reply(fd, 404, "Not Found"); return; }
  const unsigned seen = ++link->requests;
  link->last = ticks();
  const std::string range = header(request, "range");
  // The token is the link's only secret: its first eight characters are enough to tell links apart.
  const std::string name = token.substr(0, 8);
  if (seen <= kLoggedRequests) log(name + " request " + std::to_string(seen) + ": " + method + (range.empty() ? "" : " " + range));
  if (method != "GET" && method != "HEAD") { reply(fd, 405, "Method Not Allowed"); return; }

  std::uint64_t first = 0, last = link->total - 1;
  const bool ranged = !range.empty() && parse_range(range, link->total, first, last);
  if (!range.empty() && !ranged && range.find(',') == std::string::npos && range.find("=-") == std::string::npos) {
    char extra[80];
    std::snprintf(extra, sizeof extra, "Content-Range: bytes */%llu\r\n", static_cast<unsigned long long>(link->total));
    reply(fd, 416, "Range Not Satisfiable", extra);
    return;
  }
  char head[500];
  const int head_size = ranged
    ? std::snprintf(head, sizeof head, "HTTP/1.1 206 Partial Content\r\nContent-Type: application/pkg\r\n%s"
                    "Content-Range: bytes %llu-%llu/%llu\r\nContent-Length: %llu\r\n\r\n", kCommon,
                    static_cast<unsigned long long>(first), static_cast<unsigned long long>(last),
                    static_cast<unsigned long long>(link->total), static_cast<unsigned long long>(last - first + 1))
    : std::snprintf(head, sizeof head, "HTTP/1.1 200 OK\r\nContent-Type: application/pkg\r\n%sContent-Length: %llu\r\n\r\n",
                    kCommon, static_cast<unsigned long long>(link->total));
  // The HEAD the origin would refuse is answered here, from the size the app read with a GET.
  if (method == "HEAD") { send_all(fd, head, static_cast<std::size_t>(head_size)); return; }

  CURL* curl = curl_easy_init();
  if (!curl) { reply(fd, 503, "Service Unavailable", "Retry-After: 1\r\n"); return; }
  Forward forward;
  forward.fd = fd;
  forward.curl = curl;
  forward.link = link.get();
  forward.head.assign(head, static_cast<std::size_t>(head_size));
  forward.ranged = ranged;
  char span[64];
  std::snprintf(span, sizeof span, "%llu-%llu", static_cast<unsigned long long>(first), static_cast<unsigned long long>(last));
  bool ok = network::configure_transport(curl, link->url, true);
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
    if (result != CURLE_OK && !stopping && seen <= kLoggedRequests) log(name + " request " + std::to_string(seen) + " ended early: " + curl_easy_strerror(result));
    return;
  }
  // Nothing went to the console yet: it hears what the origin said, so its own error names it. An
  // expired signed link answers 403 here, which app.log says in so many words.
  if (forward.refused || forward.status >= 400) {
    log(name + " request " + std::to_string(seen) + ": the origin answered HTTP " + std::to_string(forward.status));
    if (forward.status == 403) reply(fd, 403, "Forbidden");
    else if (forward.status == 404 || forward.status == 410) reply(fd, 404, "Not Found");
    else reply(fd, 502, "Bad Gateway");
    return;
  }
  log(name + " request " + std::to_string(seen) + " failed: " + curl_easy_strerror(result));
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
    // A full house is asked to come back in a second, as a busy origin would.
    if (stopping || connections.size() >= kMaxConnections) { reply(fd, 503, "Service Unavailable", "Retry-After: 1\r\n"); close(fd); continue; }
    auto connection = std::make_unique<Connection>();
    connection->fd = fd;
    Connection* raw = connection.get();
    // TLS to the origin and libcurl's resolver want more than the console's small default stack.
    if (!raw->thread.start([raw] { serve_connection(*raw); shutdown(raw->fd, SHUT_RDWR); close(raw->fd); raw->done = true; }, 1024 * 1024)) {
      reply(fd, 503, "Service Unavailable", "Retry-After: 1\r\n");
      close(fd);
      continue;
    }
    connections.push_back(std::move(connection));
  }
}

// Binds every interface, on `wanted` when it is free (the port an earlier session's links name) or a
// port the system picks; the caller holds `mutex`.
bool listen_on(std::uint16_t wanted, std::string& error) {
  if (listener >= 0) return true;
  const int fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) { error = std::string("socket: ") + std::strerror(errno); return false; }
  const int on = 1;
  setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof on);
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_ANY);
  bool bound = false;
  for (const std::uint16_t candidate : {wanted, std::uint16_t(0)}) {
    if (candidate == 0 && bound) break;
    address.sin_port = htons(candidate);
    if (bind(fd, reinterpret_cast<sockaddr*>(&address), sizeof address) == 0) { bound = true; break; }
    if (candidate) log("port " + std::to_string(candidate) + " is taken (" + std::strerror(errno) + "); links from before cannot reconnect");
  }
  socklen_t length = sizeof address;
  if (!bound || listen(fd, 16) != 0 || getsockname(fd, reinterpret_cast<sockaddr*>(&address), &length) != 0) {
    error = std::string("listen: ") + std::strerror(errno);
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
  log("listening on port " + std::to_string(port));
  return true;
}

// The console's address on its network: the one a UDP socket "connected" to a public address would
// send from. Nothing is sent; empty when the console has no route out.
std::string lan_address() {
  const int fd = socket(AF_INET, SOCK_DGRAM, 0);
  if (fd < 0) return {};
  sockaddr_in to{};
  to.sin_family = AF_INET;
  to.sin_port = htons(53);
  inet_pton(AF_INET, "1.1.1.1", &to.sin_addr);
  sockaddr_in local{};
  socklen_t length = sizeof local;
  std::string out;
  if (connect(fd, reinterpret_cast<sockaddr*>(&to), sizeof to) == 0 &&
      getsockname(fd, reinterpret_cast<sockaddr*>(&local), &length) == 0 && local.sin_addr.s_addr != htonl(INADDR_ANY)) {
    char text[INET_ADDRSTRLEN] = {};
    if (inet_ntop(AF_INET, &local.sin_addr, text, sizeof text) && std::strncmp(text, "127.", 4)) out = text;
  }
  close(fd);
  return out;
}

// 32 random bytes as 64 hex digits: the server answers anyone on the network, and a link is only as
// private as its token.
bool new_token(std::string& out) {
  unsigned char bytes[32];
#ifdef __APPLE__
  arc4random_buf(bytes, sizeof bytes);
#else
  if (RAND_bytes(bytes, sizeof bytes) != 1) return false;
#endif
  static const char digits[] = "0123456789abcdef";
  out.clear();
  for (unsigned char byte : bytes) { out.push_back(digits[byte >> 4]); out.push_back(digits[byte & 15]); }
  return true;
}

bool valid_token(const std::string& token) {
  if (token.size() != 64) return false;
  for (char c : token) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
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

bool serve(const Request& request, Served& out, std::string& error) {
  if (!request.total) { error = "the package size is unknown"; return false; }
  std::lock_guard lock(mutex);
  if (!listen_on(request.port, error)) return false;
  std::string token = request.token;
  if (!valid_token(token) && !new_token(token)) { error = "no random bytes for the link's token"; return false; }
  auto link = std::make_shared<Link>();
  link->url = request.url;
  link->total = request.total;
  link->last = ticks();
  links[token] = link;
  const std::string path = ":" + std::to_string(port) + "/" + token + "/" + plain(request.file);
  const std::string lan = lan_address();
  out.url = lan.empty() ? std::string() : "http://" + lan + path;
  out.local_url = "http://127.0.0.1" + path;
  out.token = token;
  out.port = port;
  log(token.substr(0, 8) + " serving " + std::to_string(request.total) + " bytes at " + (lan.empty() ? "127.0.0.1 only" : lan));
  return true;
}

std::vector<Stats> stats() {
  std::lock_guard lock(mutex);
  std::vector<Stats> out;
  const auto now = ticks();
  for (const auto& [token, link] : links) {
    Stats item;
    item.token = token;
    item.total = link->total;
    item.delivered = link->delivered;
    item.requests = link->requests;
    item.idle_ms = static_cast<std::uint64_t>(std::chrono::duration_cast<std::chrono::milliseconds>(Clock::duration(now - link->last)).count());
    out.push_back(std::move(item));
  }
  return out;
}

void remove(const std::string& token) {
  std::lock_guard lock(mutex);
  links.erase(token);
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
