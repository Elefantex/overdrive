// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
#pragma once
#include <cstdint>
#include <string>
#include <vector>
// A package link served again by the app, for the console's download queue. The console asks a link
// with a HEAD before it fetches, and a pre-signed link signs only the GET it was made for: S3 and R2
// answer that HEAD 403 and the console refuses the package (0x80B22403). Here the HEAD is answered
// from the size the app already read, and each GET range is fetched from the link and passed on.
// The link works while the app runs: the console's queue reaches it through this process. It names
// the console's LAN address, which the queue treats as any other origin, and a 256-bit token, since
// the server listens on every interface.
namespace pkg_proxy {
struct Request {
  std::string url, file;
  std::uint64_t total = 0;
  // Both optional: a link served in an earlier session asks for its own token and port again, so the
  // URL the console already holds reaches it once more.
  std::string token;
  std::uint16_t port = 0;
};
struct Served {
  std::string url;        // http://<LAN address>:<port>/<token>/<file>.pkg, empty without a LAN address
  std::string local_url;  // the same on 127.0.0.1
  std::string token;
  std::uint16_t port = 0;
};
struct Stats {
  std::string token;
  std::uint64_t total = 0, delivered = 0, idle_ms = 0;
  unsigned requests = 0;
};
// Starts the server on first use and adds the link; false with `error` set when it cannot listen.
bool serve(const Request& request, Served& out, std::string& error);
// What the console has fetched of each link: body bytes sent, which a range asked twice counts twice.
std::vector<Stats> stats();
// Forgets one link; the console's next request for it is answered 404.
void remove(const std::string& token);
// Closes the server and every connection it holds.
void stop();
}
