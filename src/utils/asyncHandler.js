const asyncHandler = (requestHandler) => {
    // Return a new function that will handle the request, response, and next middleware
    return (req, res, next) => {
      // Ensure the requestHandler is treated as a promise
      Promise.resolve(requestHandler(req, res, next))
        // Catch any errors that occur during the execution of the requestHandler
        .catch((err) => {
          // Pass the error to the next middleware (usually error handling middleware)
          next(err);
        });
    };
  };

export {asyncHandler};