const fs = require('fs');

const index = fs.readFileSync(`${__dirname}/../client/client.html`);
const documentation = fs.readFileSync(`${__dirname}/../client/documentation.html`);
const css = fs.readFileSync(`${__dirname}/../client/style.css`);

const respond = (request, response, status, content, type) => {
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(content, 'utf8'),
  });
  response.write(content);
  response.end();
};

const getIndex = (request, response) => {
  respond(request, response, 200, index, 'text/html');
};

const getDocumentation = (request, response) => {
  respond(request, response, 200, documentation, 'text/html');
};

const getCSS = (request, response) => {
  respond(request, response, 200, css, 'text/css');
};

module.exports = {
  getIndex,
  getDocumentation,
  getCSS,
};
