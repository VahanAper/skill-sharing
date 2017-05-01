const http = require('http');
const ecstatic = require('ecstatic');
const Router = require('./router');

const Console = console;
const fileServer = ecstatic({
    root: './public'
});
const router = new Router();

const respond = function(response, status, data, type) {
    response.writeHead(status, {
        'Content-Type': type || 'text/plain'
    });
    response.end(data);
};

const respondJSON = function(response, status, data) {
    respond(response, status, JSON.stringify(data), 'application/json');
};

const readStreamAsJSON = function(stream, callback) {
    let data = '';

    stream.on('data', (chunk) => {
        data += chunk;
    });
    stream.on('end', () => {
        let result;
        let error;

        try {
            result = JSON.parse(data);
        } catch (e) {
            error = e;
        }
        callback(error, result);
    });
    stream.on('error', (error) => {
        callback(error);
    });
};

const sendTalks = function(talks, response) {
    respondJSON(response, 200, {
        serverTime: Date.now(),
        talks
    });
};

let waiting = [];

const waitForChanges = function(since, response) {
    const waiter = {
        since,
        response
    };

    waiting.push(waiter);
    setTimeout(() => {
        const found = waiting.indexOf(waiter);

        if (found > -1) {
            waiting.splice(found, 1);
            sendTalks([], response);
        }
    }, 90 * 1000);
};

const changes = [];
const talks = Object.create(null);

const getChangedTalks = function(since) {
    const found = [];
    const alreadySeen = function(title) {
        return found.some((f) => f.title === title);
    };

    for (let i = changes.length - 1; i >= 0; i--) {
        const change = changes[i];

        if (change.time < since) {
            break;
        } else if (alreadySeen(change.title)) {
            continue;
        } else if (change.title in talks) {
            found.push(talks[change.title]);
        } else {
            found.push({
                title: change.title,
                deleted: true
            });
        }
    }
    return found;
};

const registerChange = function(title) {
    changes.push({
        title,
        time: Date.now()
    });
    waiting.forEach((waiter) => {
        sendTalks(getChangedTalks(waiter.since), waiter.response);
    });
    waiting = [];
};

router.add('GET', /^\/talks\/([^/]+)$/, (request, response, title) => {
    if (title in talks) {
        respondJSON(response, 200, talks[title]);
    } else {
        respond(response, 404, `No talk '${title}' found.`);
    }
});

router.add('DELETE', /^\/talks\/([^/]+)$/, (request, response, title) => {
    if (title in talks) {
        delete talks[title];
        registerChange(title);
    }
    respond(response, 204, null);
});

router.add('PUT', /^\/talks\/([^/]+)$/, (request, response, title) => {

    readStreamAsJSON(request, (error, talk) => {
        if (error) {
            respond(response, 400, error.toString());
        } else if (
          ! talk
          || typeof talk.presenter != 'string'
          || typeof talk.summary != 'string'
        ) {
            respond(response, 400, 'Bad talk data.');
        } else {
            talks[title] = {
                title,
                presenter: talk.presenter,
                summary: talk.summary,
                comments: []
            };
            registerChange(title);
            respond(response, 204, null);
        }
    });
});

router.add('POST', /^\/talks\/([^/]+)\/comments$/, (request, response, title) => {
    readStreamAsJSON(request, (error, comment) => {
        if (error) {
            respond(response, 400, error.toString());
        } else if (
          !comment
          || typeof comment.author != 'string'
          || typeof comment.message != 'string'
        ) {
            respond(response, 400, 'Bad comment data.');
        } else if (title in talks) {
            talks[title].comments.push(comment);
            registerChange(title);
            respond(response, 204, null);
        } else {
            respond(response, 404, `No talk '${title}' found.`);
        }
    });
});

router.add('GET', /^\/talks$/, (request, response) => {
    const query = require('url').parse(request.url, true).query;

    if (query.changesSince == null) {
        const list = [];

        for (const title in talks) {
            if (Object.prototype.hasOwnProperty.call(talks, title)) {
                list.push(talks[title]);
            }
        }
        sendTalks(list, response);

    } else {
        const since = Number(query.changesSince);

        if (isNaN(since)) {
            respond(response, 400, 'Invalid parameter');
        } else {
            const changed = getChangedTalks(since);

            if (changed.length > 0) {
                sendTalks(changed, response);
            } else {
                waitForChanges(since, response);
            }
        }
    }
});

http.createServer((request, response) => {
    if (!router.resolve(request, response)) {
        fileServer(request, response);
    }
}).listen(8000);
Console.log('Server is running at port 8000');
