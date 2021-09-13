function checkHttp(url) {
    return new Promise((resolve, reject) => {
      const { protocol } = parse(url);
      const lib = protocol === "https:" ? require("https") : require("http");
      const request = lib.get(url, response => {
        console.log("HTTP Status Code:", response.statusCode);
        resolve(response);
      });
      request.on("error", err => {
        console.error(
          `Error trying to connect via ${protocol.replace(":", "").toUpperCase()}`
        );
        reject(err);
      });
    });
  }