const http = require('http');
const query = require('querystring');

const htmlHandler = require('./htmlResponses.js');
const dataHandler = require('./dataResponses.js');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// Parse body for POST requests
const parseBody = (request, response, handler) => {
  const body = [];

  request.on('error', (err) => {
    console.dir(err);
    response.statusCode = 400;
    response.end();
  });

  request.on('data', (chunk) => {
    body.push(chunk);
  });

  request.on('end', () => {
    const bodyString = Buffer.concat(body).toString();
    request.body = query.parse(bodyString);
    handler(request, response);
  });
};

// Handle POST requests
const handlePost = (request, response, parsedUrl) => {
  if (parsedUrl.pathname === '/addMovie') {
    parseBody(request, response, dataHandler.addMovie);
  } else if (parsedUrl.pathname === '/updateMovie') {
    parseBody(request, response, dataHandler.updateMovie);
  } else {
    dataHandler.notFound(request, response);
  }
};

// Handle GET and HEAD requests
const handleGet = (request, response, parsedUrl) => {
  if (parsedUrl.pathname === '/') {
    htmlHandler.getIndex(request, response);
  } else if (parsedUrl.pathname === '/style.css') {
    htmlHandler.getCSS(request, response);
  } else if (parsedUrl.pathname === '/getMovieTitles') {
    dataHandler.getMovieTitles(request, response, parsedUrl);
  } else if (parsedUrl.pathname === '/getTopRated') {
    dataHandler.getTopRated(request, response, parsedUrl);
  } else if (parsedUrl.pathname === '/getByDecade') {
    dataHandler.getByDecade(request, response, parsedUrl);
  } else if (parsedUrl.pathname === '/getByRuntime') {
    dataHandler.getByRuntime(request, response, parsedUrl);
  } else {
    dataHandler.notFound(request, response);
  }
};

const onRequest = (request, response) => {
  const protocol = request.connection.encrypted ? 'https' : 'http';
  const parsedUrl = new URL(request.url, `${protocol}://${request.headers.host}`);

  if (request.method === 'POST') {
    handlePost(request, response, parsedUrl);
  } else if (request.method === 'GET' || request.method === 'HEAD') {
    handleGet(request, response, parsedUrl);
  } else {
    jsonHandler.notFound(request, response);
  }
};

http.createServer(onRequest).listen(port, () => {
  console.log(`Listening on 127.0.0.1: ${port}`);
});
