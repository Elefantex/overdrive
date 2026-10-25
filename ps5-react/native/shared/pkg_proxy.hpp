// Copyright (C) 2026 half144 and PS5 React contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Additional attribution term: see LICENSE-ATTRIBUTION.
#pragma once
#include <cstdint>
#include <string>
// A package link served again from 127.0.0.1, for the console's download queue. The console asks a
// link with a HEAD before it fetches, and a pre-signed link signs only the GET it was made for: S3 and
// R2 answer that HEAD 403 and the console refuses the package (0x80B22403). Here the HEAD is answered
// from the size the app already read, and each GET range is fetched from the link and passed on.
// The link works while the app runs: the console's queue reaches it through this process.
namespace pkg_proxy {
// Returns "http://127.0.0.1:<port>/<token>/<file>.pkg" for `url`, whose size is `total` bytes, starting
// the server on first use; empty with `error` set when it cannot listen.
std::string serve(std::string url, std::uint64_t total, std::string file, std::string& error);
// Closes the server and every connection it holds.
void stop();
}
