const std = @import("std");
const heap = std.heap;
const fmt = std.fmt;
const fs = std.fs;

const httpz = @import("httpz");

const FServer = struct {

    allocator: std.mem.Allocator,
    file_types: std.StringHashMap([]const u8),

    const Self = @This();

    fn init(allocator: std.mem.Allocator) Self {
        return FServer{
            .allocator = allocator,
            .file_types = std.StringHashMap([]const u8).init(allocator),
        };
    }

    fn deinit(self: *FServer) void {
        self.file_types.deinit();
    }

    fn index(self: *FServer, _: *httpz.Request, res: *httpz.Response) !void {
        return self.serveFile("static/html/index.html", res);
    }

    fn serveStatic(self: *FServer, req: *httpz.Request, res: *httpz.Response) !void {
        return self.serveFile(req.url.path[1..], res);
    }

    fn serveFile(self: *FServer, path: []const u8, res: *httpz.Response) !void {
        const file = fs.cwd().openFile(path, .{}) catch |err| {
            if (err == fs.File.OpenError.FileNotFound) {
                res.status = 404;
                return;
            }
            return err;
        };
        defer file.close();
        const stat = try file.stat();
        res.body = try file.readToEndAlloc(res.arena, stat.size);
        res.status = 200;
        if (self.inferMime(path)) |mime_type| {
            res.headers.add("Content-Type", mime_type);
        }
    }

    fn inferMime(self: *FServer, path: []const u8) ?[]const u8 {
        var dot_idx: usize = 0;
        for (path, 0..) |c, idx| {
            if (c == '.') {
                dot_idx = idx;
            }
        }
        if (dot_idx == 0) {
            return null;
        }
        const ext = path[dot_idx..];
        const mime_type = self.file_types.get(ext);
        return mime_type;
    }
};

const file_types = [_]struct{[]const u8, []const u8}{
    .{".css", "text/css"},
    .{".gif", "image/gif"},
    .{".htm", "text/html"},
    .{".html", "text/html"},
    .{".ico", "image/vnd.microsoft.icon"},
    .{".jpeg", "image/jpeg"},
    .{".jpg", "image/jpeg"},
    .{".js", "text/javascript"},
    .{".png", "image/png"},
    .{".woff2", "font/woff2"},
};

pub fn main() !void {
    var gpa = heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

    var file_server = FServer.init(allocator);
    defer file_server.deinit();
    inline for (file_types) |file_type| {
        try file_server.file_types.put(file_type.@"0", file_type.@"1");
    }
    var server = try httpz.ServerApp(*FServer).init(allocator, .{ .port = 5000 }, &file_server);
    defer {
        server.stop();
        server.deinit();
    }

    var router = server.router();
    router.get("/", FServer.index);
    router.get("/index.html", FServer.index);
    router.get("/static/*", FServer.serveStatic);
    
    // router.get("/api/user/:id", getUser);

    try server.listen();
}

// fn getUser(req: *httpz.Request, res: *httpz.Response) !void {
//     res.status = 200;
//     try res.json(.{ .id = req.param("id").?, .name = "Teg" }, .{});
// }
