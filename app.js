const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

let database;
const initializeDBandServer = async () => {
  try {
    database = await open({
      filename: path.join(__dirname, "twitterClone.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running on http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DataBase error is ${error.message}`);
    process.exit(1);
  }
};
initializeDBandServer();

const checkThePassword = async (password) => {
  const passwordLength = password.length;
  console.log(passwordLength);
  return passwordLength > 5;
};

//Token Authentication
function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Bhavani", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
// Function for API 7
const Function_API_7 = (dbQuery) => {
  const New_Array = [];
  dbQuery.map((eachName) => New_Array.push(eachName.name));
  return New_Array;
};

// Function for API 8
const Function_API_8 = (dbUser) => {
  const New_Array = [];
  dbUser.map((each) => {
    const NewObj = {};
    NewObj["name"] = each.name;
    NewObj["reply"] = each.reply;
    New_Array.push(NewObj);
  });
  return New_Array;
};

// Creat API 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  let hashedPassword;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await database.get(selectUserQuery);

  if (dbUser === undefined) {
    if (password.length > 5) {
      hashedPassword = await bcrypt.hash(password, 10);
      const creatUserQuery = `
      INSERT INTO 
      user (username, password, name, gender)
      VALUES 
      (
        '${username}',
        '${hashedPassword}',
        '${name}',
        '${gender}'
      )
      ;`;
      await database.run(creatUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//Login API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await database.get(selectUserQuery);

  if (dbUser !== undefined) {
    const isMatched = await bcrypt.compare(password, dbUser.password);

    if (isMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Bhavani");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//Get Tweets API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const selectUserQuery = `
    SELECT 
      username,
      tweet,
      date_time AS dateTime
    FROM 
      user NATURAL JOIN tweet
      LEFT JOIN follower ON follower.follower_user_id = user.user_id
    WHERE
      follower.follower_user_id = user.user_id
    GROUP BY
      tweet.tweet_id  
    ORDER BY
      dateTime DESC
    LIMIT 4;`;
  const dbQuery = await database.all(selectUserQuery);
  response.send(dbQuery);
});

// User Following API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const SelectUserQuery = `
    SELECT
      name
    FROM
      user LEFT JOIN follower ON user.user_id = follower.follower_user_id
    WHERE 
      user.user_id = follower.follower_user_id
    GROUP BY 
      follower.follower_user_id
    ;`;
  const dbUser = await database.all(SelectUserQuery);
  response.send(dbUser);
});

// Following User API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const SelectUserQuery = `
    SELECT
      name
    FROM
      user LEFT JOIN follower ON user.user_id = follower.follower_user_id
    WHERE 
      user.user_id = follower.following_user_id
    ;`;
  const dbUser = await database.all(SelectUserQuery);
  response.send(dbUser);
});

// API 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const SelectUserQuery = `
    SELECT
      tweet,
      COUNT(like_id) AS likes,
      COUNT(reply) AS replies,
      date_time AS dateTime
    FROM
      (tweet NATURAL JOIN like
      NATURAL JOIN reply) AS TweetLikeReply
      LEFT JOIN follower ON TweetLikeReply.user_id = follower.follower_user_id
    WHERE 
      TweetLikeReply.user_id = follower.follower_user_id
      AND TweetLikeReply.tweet_id = '${tweetId}'
    GROUP BY 
        TweetLikeReply.tweet
    ;`;
  const dbUser = await database.get(SelectUserQuery);

  if (dbUser === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(dbUser);
  }
});

// API 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const checkTweetQuery = `
    SELECT
      *
    FROM 
      tweet NATURAL JOIN user
      LEFT JOIN follower ON user.user_id = follower.follower_user_id
    WHERE 
      tweet.tweet_id = '${tweetId}'
      AND user.user_id = follower.follower_user_id;
    `;
    const CheckQuery = await database.get(checkTweetQuery);
    if (CheckQuery === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const SelectUserQuery = `
        SELECT
          name
        FROM
          (user LEFT JOIN like ON user.user_id = like.user_id  
          NATURAL JOIN reply
          NATURAL JOIN tweet) AS UserTweetLikeReply
          LEFT JOIN follower ON UserTweetLikeReply.user_id = follower.follower_user_id
        WHERE 
          UserTweetLikeReply.user_id = follower.follower_user_id
          AND UserTweetLikeReply.tweet_id = '${tweetId}'
        GROUP BY UserTweetLikeReply.user_id;`;
      const dbUser = await database.all(SelectUserQuery);
      console.log(dbUser);
      response.send(`likes: [${Function_API_7(dbUser)}]`);
    }
  }
);

// API 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const checkTweetQuery = `
    SELECT
      *
    FROM 
      tweet LEFT JOIN follower ON tweet.user_id = follower.follower_user_id
    WHERE 
      tweet.tweet_id = '${tweetId}'
      AND tweet.user_id = follower.follower_user_id;
    `;
    const CheckQuery = await database.get(checkTweetQuery);
    if (CheckQuery === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const SelectUserQuery = `
        SELECT
          user.username AS name,
          reply.reply AS reply
        FROM
          (user NATURAL JOIN like
          NATURAL JOIN reply
          NATURAL JOIN tweet) AS UserTweetLikeReply
          LEFT JOIN follower ON UserTweetLikeReply.user_id = follower.follower_user_id
        WHERE 
          UserTweetLikeReply.tweet_id = '${tweetId}' 
          AND UserTweetLikeReply.user_id = follower.follower_user_id;`;
      const dbUser = await database.all(SelectUserQuery);
      response.send(`replies: [${Function_API_8(dbUser)}]`);
    }
  }
);

// API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const SelectUserQuery = `
    SELECT
      tweet,
      COUNT(user_id) AS likes,
      COUNT(user_id) AS replies,
      date_time AS dateTime
    FROM
      (tweet NATURAL JOIN like) AS TweetLike
      LEFT JOIN reply ON TweetLike.user_id = reply.user_id
    WHERE 
      TweetLike.user_id = reply.user_id
    ;`;
  const dbUser = await database.all(SelectUserQuery);
  response.send(dbUser);
});

// API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const SelectUserQuery = `
    INSERT INTO
      tweet (tweet)
    VALUES 
      ('${tweet}');
    `;
  const dbUser = await database.run(SelectUserQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const checkTweetQuery = `
    SELECT
      *
    FROM 
      user LEFT JOIN tweet ON user.user_id = tweet.user_id
    WHERE
      tweet_id = '${tweetId}';
    `;
    const CheckQuery = await database.get(checkTweetQuery);
    if (CheckQuery === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const SelectUserQuery = `
      DELETE FROM
        tweet
      WHERE 
        tweet.tweet_id = '${tweetId}';`;
      const dbUser = await database.run(SelectUserQuery);
      response.send("Tweet Removed");
    }
  }
);
////////////

module.exports = app;
