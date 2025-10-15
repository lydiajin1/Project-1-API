const fs = require('fs');
const path = require('path');

const disneyMovies = fs.readFileSync(path.resolve(__dirname, '../dataset/disney_movies.json'));
const disneyMoviesJSON = JSON.parse(disneyMovies);

// Helps filter relevant movie information
const getBasicMovieInfo = (movie) => ({
  title: movie.title,
  starring: movie.Starring,
  'directed by': movie['Directed by'],
  'release date': movie['Release date (datetime)'] || movie['Release date'],
  country: movie.Country,
  language: movie.Language,
  'running time': movie['Running time (int)'],
  'imdb rating': movie.imdb_rating,
  'rotten tomatoes': movie.rotten_tomatoes,
});

// Function to respond with a json object
const respondJSON = (request, response, status, object) => {
  const content = JSON.stringify(object);

  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(content, 'utf8'),
  });

  if (request.method !== 'HEAD' && status !== 204) {
    response.write(content);
  }

  response.end();
};

// Returns movie titles with optional filtering
const getMovieTitles = (request, response, parsedUrl) => {
  // Extract query parameters
  const { searchParams } = parsedUrl;
  const actor = searchParams.get('actor');
  const yearParam = searchParams.get('year');

  let responseData = disneyMoviesJSON;

  // Filter by actor if provided
  if (actor) {
    responseData = responseData.filter((movie) => {
      // Check if 'Starring' field exists and is an array
      if (movie.Starring && Array.isArray(movie.Starring)) {
        // Compare case-insensitively; allow partial name matches
        return movie.Starring.some((star) => star.toLowerCase().includes(actor.toLowerCase()));
      }
      return false;
    });
  }

  // Filter by year if provided
  if (yearParam) {
    const year = parseInt(yearParam, 10);
    // Validate year is 4 digits and between 1937 and 2021
    if (Number.isNaN(year) || year < 1937 || year > 2021 || yearParam.length !== 4) {
      return respondJSON(request, response, 400, {
        error: 'Year must be a 4-digit number between 1937 and 2021',
        id: 'invalidYear',
      });
    }

    responseData = responseData.filter((movie) => {
      // Check both 'Release date' and 'Release date (datetime)' fields
      if (movie['Release date'] && Array.isArray(movie['Release date'])) {
        return movie['Release date'].some((date) => date.includes(yearParam));
      }
      // Check 'Release date (datetime)' field if 'Release date' is not available
      if (movie['Release date (datetime)']) {
        return movie['Release date (datetime)'].includes(yearParam);
      }
      return false;
    });
  }

  // Extract titles from the filtered movies
  const titles = responseData.map((movie) => movie.title).filter(Boolean);

  return respondJSON(request, response, 200, titles);
};

// Returns top rated movies
const getTopRated = (request, response, parsedUrl) => {
  // Extract query parameters
  const { searchParams } = parsedUrl;
  const minRatingParam = searchParams.get('minRating');
  const limitParam = searchParams.get('limit');

  // Get minimum rating and limit, with defaults
  let minRating;
  if (minRatingParam) {
    minRating = parseFloat(minRatingParam);
  } else {
    minRating = 0;
  }

  let limit;
  if (limitParam) {
    limit = parseInt(limitParam, 10);
  } else {
    limit = 10;
  }

  // Validate minRating parameter
  if (minRatingParam && Number.isNaN(minRating)) {
    return respondJSON(request, response, 400, {
      error: 'minRating must be a valid number',
      id: 'invalidMinRating',
    });
  }

  // Validate minRating is between 0 and 10
    if (minRating < 0 || minRating > 10) {
    return respondJSON(request, response, 400, {
      error: 'minRating must be between 0 and 10',
      id: 'outOfRangeMinRating',
    });
  }
  
  // Validate limit parameter
  if (limitParam && (Number.isNaN(limit) || limit < 1)) {
    return respondJSON(request, response, 400, {
      error: 'limit must be a valid positive number',
      id: 'invalidLimit',
    });
  }

  // Filter movies that have valid ratings
  let responseData = disneyMoviesJSON.filter((movie) => {
    if (!movie.imdb_rating) return false;
    const rating = parseFloat(movie.imdb_rating);
    return !Number.isNaN(rating) && rating >= minRating;
  });

  // Referenced MDN - Mozilla for .sort method and .slice(0, limit)
  // Sort movies by rating in descending order
  responseData.sort((a, b) => parseFloat(b.imdb_rating) - parseFloat(a.imdb_rating));

  // Limit the number of results
  responseData = responseData.slice(0, limit);

  // Filter to show only relevant information
  const filteredMovies = responseData.map(getBasicMovieInfo);

  return respondJSON(request, response, 200, filteredMovies);
};

// Returns movies from a specific decade
const getByDecade = (request, response, parsedUrl) => {
  const { searchParams } = parsedUrl;
  const decadeParam = searchParams.get('decade');

  // Validate decade parameter
  if (!decadeParam) {
    return respondJSON(request, response, 400, {
      error: 'Decade is required.',
      id: 'getByDecadeMissingParam',
    });
  }

  // Validate decade is a 4-digit number ending in 0 (like 1940, 1990, 2020)
  const decadeNum = parseInt(decadeParam, 10);
  if (Number.isNaN(decadeNum) || decadeParam.length !== 4 || decadeNum % 10 !== 0) {
    return respondJSON(request, response, 400, {
      error: 'Decade must be a 4-digit year ending in 0 (e.g., 1940, 1990, 2020)',
      id: 'invalidDecade',
    });
  }

  // Filter movies released within the specified decade
  // .match() method referenced from MDN - Mozilla for regex usage
  const responseData = disneyMoviesJSON.filter((movie) => {
    if (movie['Release date (datetime)']) {
      // Extract year from 'Release date (datetime)' using regex
      // Check if the year falls within the specified decade range
      const yearMatch = movie['Release date (datetime)'].match(/\d{4}/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0], 10);
        return year >= decadeNum && year < decadeNum + 10;
      }
    }
    return false;
  });

  // Filter to show only relevant information
  const filteredMovies = responseData.map(getBasicMovieInfo);

  return respondJSON(request, response, 200, filteredMovies);
};

// Returns movies filtered by runtime
const getByRuntime = (request, response, parsedUrl) => {
  // Extract query parameters
  const { searchParams } = parsedUrl;
  const minParam = searchParams.get('min');
  const maxParam = searchParams.get('max');
  const limitParam = searchParams.get('limit');

  // Validate that both min and max are provided
  if (!minParam || !maxParam) {
    return respondJSON(request, response, 400, {
      error: 'Both min and max runtime are required',
      id: 'missingRuntimeParams',
    });
  }

  // Parse min, max, and limit parameters
  const min = parseInt(minParam, 10);
  const max = parseInt(maxParam, 10);
  const limit = limitParam && parseInt(limitParam, 10);

  // Validate min and max are valid numbers
  if (Number.isNaN(min) || Number.isNaN(max)) {
    return respondJSON(request, response, 400, {
      error: 'Min and max must be valid numbers',
      id: 'invalidRuntimeParams',
    });
  }

  // Validate min is less than max
  if (min > max) {
    return respondJSON(request, response, 400, {
      error: 'Min runtime must be less than or equal to max runtime',
      id: 'invalidRuntimeRange',
    });
  }

  // Filter movies based on runtime
  let responseData = disneyMoviesJSON.filter((movie) => {
    const runtime = movie['Running time (int)'];
    // .typeof reference: operator returns a string indicating the type of the operand's value.
    // return false if runtime is not a number
    if (typeof runtime !== 'number') return false;

    return runtime >= min && runtime <= max;
  });

  // Limit the number of results if limit is a valid number
  if (limit && !Number.isNaN(limit) && limit > 0) {
    responseData = responseData.slice(0, limit);
  }

  // Filter to show only relevant information
  const filteredMovies = responseData.map(getBasicMovieInfo);

  return respondJSON(request, response, 200, filteredMovies);
};

// Adds a new movie to the dataset
const addMovie = (request, response) => {
  // Extract movie details from the request body
  const {
    title, year, runtime, rating,
  } = request.body;

  // Validate all required fields
  if (!title || !year || !runtime || !rating) {
    return respondJSON(request, response, 400, {
      error: 'Title, year, runtime, and rating are all required',
      id: 'addMovieMissingParams',
    });
  }

  // Validate year is a 4-digit number
  const yearNum = parseInt(year, 10);
  const yearString = year.toString();
  if (Number.isNaN(yearNum) || yearString.length !== 4) {
    return respondJSON(request, response, 400, {
      error: 'Year must be a 4-digit number',
      id: 'invalidYear',
    });
  }

  // Check for duplicate titles (case-insensitive)
  const titleExists = disneyMoviesJSON.some(
    (movie) => movie.title && movie.title.toLowerCase() === title.toLowerCase(),
  );
  if (titleExists) {
    return respondJSON(request, response, 400, {
      error: `Movie with title "${title}" already exists`,
      id: 'movieExists',
    });
  }

  // Validate runtime
  const runtimeNum = parseInt(runtime, 10);
  if (Number.isNaN(runtimeNum) || runtimeNum <= 0) {
    return respondJSON(request, response, 400, {
      error: 'Runtime must be a valid positive number',
      id: 'invalidRuntime',
    });
  }

  // Validate rating
  const ratingNum = parseFloat(rating);
  if (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10) {
    return respondJSON(request, response, 400, {
      error: 'Rating must be a valid number between 0 and 10',
      id: 'invalidRating',
    });
  }

  // Create new movie object
  const newMovie = {
    title,
    'Release date': year.toString(),
    'Running time (int)': runtimeNum,
    imdb_rating: rating.toString(),
  };

  // Add the new movie to the dataset
  disneyMoviesJSON.push(newMovie);

  return respondJSON(request, response, 201, newMovie);
};

// Rates an existing movie
const rateMovie = (request, response) => {
  // Extract title and rating from the request body
  const { title, rating } = request.body;

  // Validate required fields
  if (!title || !rating) {
    return respondJSON(request, response, 400, {
      error: 'Title and rating body parameters are both required',
      id: 'rateMovieMissingParams',
    });
  }

  // Validate rating is a number
  const ratingNum = parseFloat(rating);
  if (Number.isNaN(ratingNum) || ratingNum < 0 || ratingNum > 10) {
    return respondJSON(request, response, 400, {
      error: 'Rating must be a valid number between 0 and 10',
      id: 'invalidRating',
    });
  }

  // Find the movie by title (case-insensitive)
  const movieIndex = disneyMoviesJSON.findIndex(
    (movie) => movie.title && movie.title.toLowerCase() === title.toLowerCase(),
  );

  // If movie not found, return 404
  if (movieIndex === -1) {
    return respondJSON(request, response, 404, {
      error: `No movie found with title: ${title}`,
      id: 'movieNotFound',
    });
  }

  // Check if the rating is already the same
  if (disneyMoviesJSON[movieIndex].imdb_rating === rating.toString()) {
    // Return 204 (No Content) - no change needed
    return respondJSON(request, response, 204, {});
  }

  // Update the movie rating
  disneyMoviesJSON[movieIndex].imdb_rating = rating.toString();

  // Return 200 with the updated movie
  return respondJSON(request, response, 200, disneyMoviesJSON[movieIndex]);
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
