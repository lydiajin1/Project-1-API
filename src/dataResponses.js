const fs = require('fs');
const path = require('path');

const disneyMovies = fs.readFileSync('./dataset/disney_movies.json');
const disneyMoviesJSON = JSON.parse(disneyMovies);

const respondJSON = (request, response, status, object) => {
  const content = JSON.stringify(object);

  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(content, 'utf8'),
  });

  if (request.method !== 'HEAD') {
    response.write(content);
  }

  response.end();
};

// Returns movie titles with optional filtering
const getMovieTitles = (request, response, parsedUrl) => {

};

// Returns top rated movies
const getTopRated = (request, response, parsedUrl) => {
  
};

// Returns movies from a specific decade
const getByDecade = (request, response, parsedUrl) => {

};

// Returns movies filtered by runtime
const getByRuntime = (request, response, parsedUrl) => {

};

// Adds a new movie to the dataset
const addMovie = (request, response) => {

};

// Rates an existing movie
const rateMovie = (request, response) => {

};


// Handle 404 not found
const notFound = (request, response) => {
  const responseJSON = {
    message: 'The page you are looking for was not found.',
    id: 'notFound',
  };

  respondJSON(request, response, 404, responseJSON);
};

module.exports = {
  getMovieTitles,
  getTopRated,
  getByDecade,
  getByRuntime,
  addMovie,
  rateMovie,
  notFound,
};
