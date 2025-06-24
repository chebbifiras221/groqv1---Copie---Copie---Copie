import { NextResponse } from "next/server";                      // Next.js response utility for API routes

export type AuthRequest = {                                     // TypeScript type for incoming authentication requests
  type: 'register' | 'login' | 'verify' | 'logout';            // Type of authentication operation
  username?: string;                                            // Username (optional, depends on operation type)
  password?: string;                                            // Password (optional, depends on operation type)
  token?: string;                                               // JWT token (optional, for verify/logout operations)
};

export type AuthResponse = {                                    // TypeScript type for authentication API responses
  success: boolean;                                             // Whether the operation was successful
  message: string;                                              // Human-readable message about the result
  errorType?: 'username' | 'password' | 'username_exists' | 'token' | 'validation' | 'server_error' | string; // Specific error type for frontend handling
  user?: {                                                      // User data (returned on successful login/verify)
    id: string;                                                 // Unique user identifier
    username: string;                                           // User's display name
  };
  token?: string;                                               // JWT token (returned on successful login)
};

export async function POST(request: Request) {                   // Handle POST requests to the auth API endpoint
  try {                                                          // Wrap everything in try-catch for error handling
    const body: AuthRequest = await request.json();             // Parse the JSON request body

    // Get the WebSocket URL from environment variables
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;          // Get LiveKit URL from environment
    if (!wsUrl) {                                               // Check if environment variable is set
      throw new Error("LIVEKIT_URL is not defined");           // Throw error if missing (will be caught below)
    }

    // Basic validation for different request types
    if (body.type === 'register' && (!body.username || !body.password)) { // Validate register request
      return NextResponse.json({                                // Return error response
        success: false,                                         // Operation failed
        message: "Username and password are required",         // Error message for user
        errorType: "validation"                                 // Error type for frontend handling
      }, { status: 400 });                                     // HTTP 400 Bad Request
    }
    else if (body.type === 'login' && (!body.username || !body.password)) { // Validate login request
      return NextResponse.json({                                // Return error response
        success: false,                                         // Operation failed
        message: "Username and password are required",         // Error message for user
        errorType: "validation"                                 // Error type for frontend handling
      }, { status: 400 });                                     // HTTP 400 Bad Request
    }
    else if (body.type === 'verify' && !body.token) {
      return NextResponse.json({
        success: false,
        message: "Token is required",
        errorType: "validation"
      }, { status: 400 });
    }
    else if (body.type === 'logout' && !body.token) {
      return NextResponse.json({
        success: false,
        message: "Token is required",
        errorType: "validation"
      }, { status: 400 });
    }
    else if (!['register', 'login', 'verify', 'logout'].includes(body.type)) {
      return NextResponse.json({
        success: false,
        message: "Invalid request type",
        errorType: "validation"
      }, { status: 400 });
    }

    // Use a simple in-memory storage approach with file persistence
    try {
      // Import the fs and path modules for file operations
      // Use dynamic import to avoid issues with Next.js
      const { promises: fs, existsSync, mkdirSync, readFileSync, writeFileSync } = await import('fs');
      const { join } = await import('path');

      // Define the path to the users file
      const usersFilePath = join(process.cwd(), 'data', 'users.json');
      const dataDir = join(process.cwd(), 'data');

      // Create the data directory if it doesn't exist
      if (!existsSync(dataDir)) {
        try {
          mkdirSync(dataDir, { recursive: true });
          // Data directory created successfully
        } catch (error) {
          // Error creating data directory - will continue with defaults
        }
      }

      // Load users from file or create an empty object
      let users: Record<string, { id: string; username: string; password: string; token?: string }> = {};
      try {
        if (existsSync(usersFilePath)) {
          const usersData = readFileSync(usersFilePath, 'utf8');
          users = JSON.parse(usersData);
          // Users loaded from file successfully
        } else {
          // Create a default test user
          users = {
            "test": {
              id: "user-test-123",
              username: "test",
              password: "password"
            }
          };

          // Save the initial users file
          writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        }
      } catch (error) {
        // Error loading users file - will create default user
        users = {
          "test": {
            id: "user-test-123",
            username: "test",
            password: "password"
          }
        };
      }

      // Function to save users to file
      const saveUsers = async () => {
        try {
          // Use async writeFile for better performance
          await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
          // Users saved to file successfully
        } catch (error) {
          // Error saving users file - fallback to sync method
          try {
            writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
            // Users saved to file (sync) successfully
          } catch (syncError) {
            // Error saving users file (sync) - continuing without persistence
          }
        }
      };

      // Handle registration
      if (body.type === 'register') {
        const username = body.username!;

        // Check if username already exists
        if (users[username]) {
          return NextResponse.json({
            success: false,
            message: "Username already exists",
            errorType: "username_exists"
          }, { status: 400 });
        }

        // Create a new user
        const userId = `user-${Date.now()}`;
        users[username] = {
          id: userId,
          username: username,
          password: body.password
        };

        // Save users to file
        await saveUsers();

        return NextResponse.json({
          success: true,
          message: "User registered successfully",
          user: {
            id: userId,
            username: username
          }
        });
      }
      // Handle login
      else if (body.type === 'login') {
        const username = body.username!;
        const password = body.password!;

        // Check if user exists
        const user = users[username];
        if (!user) {
          return NextResponse.json({
            success: false,
            message: "User does not exist",
            errorType: "username"
          }, { status: 401 });
        }

        // Check if password matches
        if (user.password !== password) {
          return NextResponse.json({
            success: false,
            message: "Password is incorrect",
            errorType: "password"
          }, { status: 401 });
        }

        // Generate a token
        const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Store the token with the user
        user.token = token;

        // Save users to file
        await saveUsers();

        return NextResponse.json({
          success: true,
          message: "Login successful",
          user: {
            id: user.id,
            username: user.username
          },
          token
        });
      }
      // Handle token verification
      else if (body.type === 'verify') {
        const token = body.token!;

        // Find user with this token
        let foundUser = null;
        for (const username in users) {
          if (users[username].token === token) {
            foundUser = users[username];
            break;
          }
        }

        if (!foundUser) {
          return NextResponse.json({
            success: false,
            message: "Invalid token",
            errorType: "token"
          }, { status: 401 });
        }

        return NextResponse.json({
          success: true,
          message: "Token verified",
          user: {
            id: foundUser.id,
            username: foundUser.username
          }
        });
      }
      // Handle logout
      else if (body.type === 'logout') {
        const token = body.token!;

        // Find user with this token and remove the token
        for (const username in users) {
          if (users[username].token === token) {
            delete users[username].token;
            break;
          }
        }

        // Save users to file
        await saveUsers();

        return NextResponse.json({
          success: true,
          message: "Logout successful"
        });
      }

      // This should never happen due to validation above
      return NextResponse.json({
        success: false,
        message: "Invalid request type",
        errorType: "validation"
      }, { status: 400 });
    } catch (error) {
      // Auth processing error
      return NextResponse.json({
        success: false,
        message: error instanceof Error ? error.message : "Server error",
        errorType: "server_error"
      }, { status: 500 });
    }

  } catch (error) {
    // Auth API error
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      errorType: "server_error"
    }, { status: 500 });
  }
}
