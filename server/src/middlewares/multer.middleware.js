import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + file.originalname)
    }
  })
  
export const upload = multer({ 
    storage,
})


/*

This file code is doing the following:

**It's a middleware function for user authentication**

When a user makes a request to the server, this middleware function checks if the user is authenticated (logged in) or not.

**Here's what it does:**

1. **Checks for an access token**: It looks for an access token in the request cookies or in the `Authorization` header.
2. **Verifies the token**: If it finds a token, it verifies it using a secret key.
3. **Gets the user's ID**: If the token is valid, it extracts the user's ID from the token.
4. **Finds the user in the database**: It uses the user's ID to find the corresponding user in the database.
5. **Checks if the user exists**: If the user is found, it checks if the user exists in the database.
6. **Adds the user to the request**: If the user exists, it adds the user object to the request object (`req.user`).
7. **Calls the next middleware function**: Finally, it calls the next middleware function in the chain, passing the updated request object.

**In simple words**, this code is like a security guard that checks if a user is allowed to enter a restricted area (the server). If the user has a valid access token, it lets them in and gives them access to the server. If not, it blocks them from entering.

*/