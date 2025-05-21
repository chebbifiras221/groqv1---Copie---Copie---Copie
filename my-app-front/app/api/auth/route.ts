import { NextResponse } from "next/server";

export type AuthRequest = {
  type: 'register' | 'login' | 'verify';
  username?: string;
  password?: string;
  email?: string;
  token?: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  errorType?: 'username' | 'password' | string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  token?: string;
};

// Simple in-memory user store for demo purposes
// In a real app, this would be a database
// NOTE: This is reset on every request because API routes are serverless functions
const users: Record<string, any> = {
  // Add a test user for demonstration
  "test": {
    id: "user-test-123",
    username: "test",
    password: "password", // In a real app, this would be hashed
    email: "test@example.com"
  }
};

export async function POST(request: Request) {
  try {
    const body: AuthRequest = await request.json();

    // Basic validation
    if (body.type === 'register' && (!body.username || !body.password)) {
      return NextResponse.json({
        success: false,
        message: "Username and password are required"
      }, { status: 400 });
    }
    else if (body.type === 'login' && (!body.username || !body.password)) {
      return NextResponse.json({
        success: false,
        message: "Username and password are required"
      }, { status: 400 });
    }
    else if (body.type === 'verify' && !body.token) {
      return NextResponse.json({
        success: false,
        message: "Token is required"
      }, { status: 400 });
    }
    else if (!['register', 'login', 'verify'].includes(body.type)) {
      return NextResponse.json({
        success: false,
        message: "Invalid request type"
      }, { status: 400 });
    }

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
        password: body.password, // In a real app, this would be hashed
        email: body.email
      };

      return NextResponse.json({
        success: true,
        message: "User registered successfully",
        user: {
          id: userId,
          username: username,
          email: body.email
        }
      });
    }
    // Handle login
    else if (body.type === 'login') {
      const username = body.username!;
      const password = body.password!;

      console.log(`Login attempt for user: ${username}`);
      console.log(`Available users:`, Object.keys(users));

      // Check if user exists
      const user = users[username];
      if (!user) {
        console.log(`User ${username} does not exist`);
        return NextResponse.json({
          success: false,
          message: "User does not exist",
          errorType: "username"
        }, { status: 401 });
      }

      // Check if password matches
      console.log(`User found, checking password. Expected: ${user.password}, Provided: ${password}`);
      if (user.password !== password) {
        console.log(`Password incorrect for user ${username}`);
        return NextResponse.json({
          success: false,
          message: "Password is incorrect",
          errorType: "password"
        }, { status: 401 });
      }

      console.log(`Login successful for user ${username}`);

      // Generate a token
      const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Store the token with the user
      user.token = token;

      return NextResponse.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email
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
          message: "Invalid token"
        }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        message: "Token verified",
        user: {
          id: foundUser.id,
          username: foundUser.username,
          email: foundUser.email
        }
      });
    }

    // This should never happen due to validation above
    return NextResponse.json({
      success: false,
      message: "Invalid request type"
    }, { status: 400 });

  } catch (error) {
    console.error("Auth API error:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
