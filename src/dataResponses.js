const fs = require('fs');
const path = require('path');

const disneyMovies = fs.readFileSync(path.resolve(__dirname, '../dataset/disney_movies.json'));
const disneyMoviesJSON = JSON.parse(disneyMovies);

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
  const year = searchParams.get('year');

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
  if (year) {
    responseData = responseData.filter((movie) => {
      // Check both 'Release date' and 'Release date (datetime)' fields
      if (movie['Release date'] && Array.isArray(movie['Release date'])) {
        return movie['Release date'].some((date) => date.includes(year));
      }
      // Check 'Release date (datetime)' field if 'Release date' is not available
      if (movie['Release date (datetime)']) {
        return movie['Release date (datetime)'].includes(year);
      }
      return false;
    });
  }

  // Extract titles from the filtered movies
  const titles = responseData.map((movie) => movie.title).filter(Boolean);

  return respondJSON(request, response, 200, { titles, count: titles.length });
};

// Returns top rated movies
// ****Not working properly yet****
const getTopRated = (request, response, parsedUrl) => {
  // Extract query parameters
  const { searchParams } = parsedUrl;
  // Get minimum rating and limit, with defaults
  const minRating = parseFloat(searchParams.get('minRating')) || 0;
  const limit = parseInt(searchParams.get('limit'), 10) || 10;

  // Filter movies by minimum rating
  let responseData = disneyMoviesJSON.filter((movie) => {
    const rating = parseFloat(movie.rating);
    return !Number.isNaN(rating) && rating >= minRating;
  });

  // Referenced MDN - Mozilla for .sort method and .slice(0, limit)
  // Sort movies by rating in descending order and limit the results
  responseData.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

  // Limit the number of results
  responseData = responseData.slice(0, limit);

  return respondJSON(request, response, 200, { movies: responseData, count: responseData.length });
};

// Returns movies from a specific decade
const getByDecade = (request, response, parsedUrl) => {
  const { searchParams } = parsedUrl;
  const decade = searchParams.get('decade');

  // Validate decade parameter
  if (!decade) {
    return respondJSON(request, response, 400, {
      error: 'Decade is required.',
      id: 'getByDecadeMissingParam',
    });
  }

  // Extract the starting year from the decade string
  const decadeNum = parseInt(decade, 10);
  if (Number.isNaN(decadeNum)) {
    return respondJSON(request, response, 400, {
      error: 'Invalid decade format. Use format like "1990s" or "1990"',
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

  // Return the filtered movies
  return respondJSON(request, response, 200, {
    decade,
    movies: responseData,
    count: responseData.length,
  });
};

// Returns movies filtered by runtime
const getByRuntime = (request, response, parsedUrl) => {
  // Extract query parameters
  const { searchParams } = parsedUrl;
  // Parse min, max, and limit parameters
  const min = parseInt(searchParams.get('min'), 10);
  const max = parseInt(searchParams.get('max'), 10);
  const limit = parseInt(searchParams.get('limit'), 10);

  // Filter movies based on runtime
  let responseData = disneyMoviesJSON.filter((movie) => {
    const runtime = movie['Running time (int)'];
    // .typeof reference: operator returns a string indicating the type of the operand's value.
    // return false if runtime is not a number
    if (typeof runtime !== 'number') return false;

    // Only check min and max if they are valid numbers
    if (Number.isNaN(min) || (min !== undefined && runtime < min)) return false;
    if (Number.isNaN(max) || (max !== undefined && runtime > max)) return false;

    return true;
  });

  // Limit the number of results if limit is a valid number
  if (limit && !Number.isNaN(limit)) {
    responseData = responseData.slice(0, limit);
  }

  return respondJSON(request, response, 200, {
    movies: responseData,
    count: responseData.length,
  });
};

// Adds a new movie to the dataset
// ****Not working properly yet****
const addMovie = (request, response) => {
  // Extract movie details from the request body
  const {
    title, year, genre, director, runtime, rating,
  } = request.body;

  // Validate required fields
  if (!title) {
    return respondJSON(request, response, 400, {
      error: 'Title is required.',
      id: 'addMovieMissingParams',
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

  // Create new movie object
  const newMovie = {
    title,
    'Release date': year ? [year.toString()] : [],
    'Release date (datetime)': year ? year.toString() : '',
    Genre: genre ? [genre] : [],
    'Directed by': director ? [director] : [],
    'Running time (int)': runtime ? parseInt(runtime, 10) : null,
    rating: rating ? rating.toString() : null,
  };

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
      id: 'rateFilmMissingParams',
    });
  }

  // Validate rating is a number
  const ratingNum = parseFloat(rating);
  if (Number.isNaN(ratingNum)) {
    return respondJSON(request, response, 400, {
      error: 'Rating must be a valid number',
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
      error: `No movie has title: ${title}`,
      id: 'titleNotFound',
    });
  }

  disneyMoviesJSON[movieIndex].rating = rating.toString();

  return respondJSON(request, response, 204, {});
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
