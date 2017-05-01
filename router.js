const Router = module.exports = function() {
    this.routes = [];
};

Router.prototype.add = function(method, url, handler) {
    this.routes.push({
        method,
        url,
        handler
    });
};

Router.prototype.resolve = function(request, response) {
    const path = require('url').parse(request.url).pathname;

    return this.routes.some((route) => {
        const match = route.url.exec(path);

        if(!match || route.method !== request.method) {
            return false;
        }

        const urlParts = match.slice(1).map(decodeURIComponent);

        route.handler.apply(null, [request, response].concat(urlParts));
        return true;
    });
};
