import JWT from 'jsonwebtoken';
import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/apiError.js';
import { User } from '../models/user.model.js';

export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        // there are two common ways to send access tokens in HTTP requests:
        // 1. As a cookie (req.cookies.accessToken)
        // 2. In the Authorization header (req.header("Authorization").replace("Bearer ", ""))


        if (!accessToken) {
            throw new ApiError(401, "Unauthorized request");
        }
    
        const decodedToken = JWT.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id).select(" -password -refreshToken");
        // exclude password and refreshToken from the user object when retrieving from database

        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }
    
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});


/*

Let me explain the code in simple words.

This file is called `auth.middleware.js` and it's a middleware function that helps with user authentication.

**What is authentication?**
Authentication is the process of verifying who a user is and making sure they have permission to access certain parts of the application.

**What does this code do?**

Here's a step-by-step explanation:

1. **Check if the user has a valid token**: The code checks if the user has a special token (called an "access token") in their cookies or in the `Authorization` header of the request.
2. **If no token, throw an error**: If the user doesn't have a valid token, the code throws an error with a 401 status code (Unauthorized).
3. **Verify the token**: If the user has a token, the code verifies it using a secret key (stored in an environment variable called `ACCESS_TOKEN_SECRET`).
4. **Get the user's ID from the token**: If the token is valid, the code extracts the user's ID from the token.
5. **Find the user in the database**: The code uses the user's ID to find the corresponding user in the database.
6. **If no user, throw an error**: If the user is not found in the database, the code throws an error with a 401 status code (Unauthorized).
7. **Add the user to the request**: If the user is found, the code adds the user object to the request object (`req.user`).
8. **Call the next middleware function**: Finally, the code calls the next middleware function in the chain, passing the updated request object.

In simple words, this code is like a bouncer at a club. It checks if the user has a valid ticket (token) and if they're allowed to enter the club (have permission to access certain parts of the application). If everything checks out, it lets the user in and adds their information to the request.


*/