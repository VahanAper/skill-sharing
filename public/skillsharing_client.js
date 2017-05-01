const Console = console;
const reportError = function(error) {
    if(error) {
        Console.error(error.toString());
    }
};
const request = function(options, callback) {
    const req = new XMLHttpRequest();

    req.open(options.method || 'GET', options.pathname, true);
    req.addEventListener('load', () => {
        if (req.status < 400) {
            callback(null, req.responseText);
        } else {
            callback(new Error(`Request failed: ${req.statusText}`));
        }
    });
    req.addEventListener('error', () => {
        callback(new Error('Network error.'));
    });
    req.send(options.body || null);
};
const talkURL = function(title) {
    return `talks/${encodeURIComponent(title)}`;
};
const deleteTalk = function(title) {
    request({
        pathname: talkURL(title),
        method: 'DELETE'
    }, reportError);
};
const nameField = document.querySelector('#name');
const addComment = function(title, message) {
    const comment = {author: nameField.value, message};

    request({
        pathname: `${talkURL(title)}/comments`,
        body: JSON.stringify(comment),
        method: 'POST'
    }, reportError);
};
const talkForm = document.querySelector('#newTalk');

nameField.value = localStorage.getItem('name') || '';
nameField.addEventListener('change', () => {
    localStorage.setItem('name', nameField.value);
});

talkForm.addEventListener('submit', (event) => {
    event.preventDefault();
    request({
        pathname: talkURL(talkForm.elements.title.value),
        method: 'PUT',
        body: JSON.stringify({
            presenter: nameField.value,
            summary: talkForm.elements.summary.value
        })
    }, reportError);
    talkForm.reset();
});
let lastServerTime = 0;
const talkDiv = document.querySelector('#talks');
const shownTalks = Object.create(null);
const instantiateTemplate = function(name, values) {
    const instantiateText = function(text) {
        return text.replace(/\{\{(\w+)\}\}/g, (_, nameText) =>
            values[nameText]
        );
    };
    const instantiate = function(node) {
        if(node.nodeType === document.ELEMENT_NODE) {
            const copy = node.cloneNode();

            for(let i = 0; i < node.childNodes.length; i++) {
                copy.appendChild(instantiate(node.childNodes[i]));
            }
            return copy;
        } else if(node.nodeType === document.TEXT_NODE) {
            return document.createTextNode(instantiateText(node.nodeValue));
        }
        return node;
    };

    const template = document.querySelector(`#template .${name}`);
    
    return instantiate(template);
};
const drawTalk = function(talk) {
    const node = instantiateTemplate('talk', talk);
    const comments = node.querySelector('.comments');
    const form = node.querySelector('form');

    talk.comments.forEach((comment) => {
        comments.appendChild(instantiateTemplate('comment', comment));
    });

    node.querySelector('button.del').addEventListener('click', deleteTalk.bind(null, talk.title));

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        addComment(talk.title, form.elements.comment.value);
        form.reset();
    });

    return node;
};
const displayTalks = function(talks) {
    talks.forEach((talk) => {
        const shown = shownTalks[talk.title];

        if (talk.deleted) {
            if (shown) {
                talkDiv.removeChild(shown);
                delete shownTalks[talk.title];
            }
        } else {
            const node = drawTalk(talk);

            if (shown) {
                talkDiv.replaceChild(node, shown);
            } else {
                talkDiv.appendChild(node);
            }
            shownTalks[talk.title] = node;
        }
    });
};

const waitForChanges = function() {
    request({
        pathname: `talks?changesSince=${lastServerTime}`
    }, (error, response) => {
        if (error) {
            setTimeout(waitForChanges, 2500);
            Console.error(error.stack);
        } else {
            const res = JSON.parse(response);

            displayTalks(res.talks);
            lastServerTime = res.serverTime;
            waitForChanges();
        }
    });
};

request({pathname: 'talks'}, (error, response) => {
    if (error) {
        reportError(error);
    } else {
        let res = JSON.parse(response);

        displayTalks(res.talks);
        lastServerTime = res.serverTime;
        waitForChanges();
    }
});
