// Define all the routes for the API
const express = require("express");
const router = express.Router();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db/news.db");
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto").createHash("sha256");

dotenv.config();

function createHash(password) {
  return crypto.update(password).copy().digest("hex");
}

router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // * = allow all domains
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.setHeader(
    // allow these methods
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  next();
});

FETCH_URL =
  "https://newsapi.org/v2/everything?" +
  "q=India&" +
  "from=2023-09-31&" +
  "apiKey=" +
  process.env.API_KEY;

// GET all news items paginated
router.get("/news", (req, res, next) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 12;
  const offset = (page - 1) * limit;

  // sort by publishedAt
  db.all(
    "SELECT * FROM news ORDER BY publishedAt DESC LIMIT ? OFFSET ?",
    [limit, offset],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(200).json(
        rows.map((row) => {
          return {
            img: row.urlToImage,
            title: row.title,
            description: row.description,
            content: row.content,
            url: row.url,
          };
        })
      );
    }
  );
});

// GET a single news item
router.get("/news/:id", (req, res, next) => {
  db.get("SELECT * FROM news WHERE id = ?", [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(200).json({
      img: row.urlToImage,
      title: row.title,
      description: row.description,
      content: row.content,
      url: row.url,
    });
  });
});

let fetched_pages = 0;

// Refresh database with new data
router.post("/refresh", (req, res, next) => {
  let count = 0;
  fetched_pages += 1;
  console.log("Fetching page " + fetched_pages);
  axios
    .get(FETCH_URL + "&page=" + fetched_pages)
    .then((response) => {
      if (response.data.status !== "ok") {
        res.status(500).json({ error: "Error fetching data from News API" });
        return;
      }

      // Create a new table if it does not exist
      db.run(
        "CREATE TABLE IF NOT EXISTS news (id TEXT PRIMARY KEY, title TEXT, description TEXT, content TEXT, url TEXT, urlToImage TEXT, publishedAt TEXT)",
        (err) => {
          if (err) {
            console.log(err);
            res.status(500).json({ error: err.message });
            return;
          }
        }
      );

      // Insert each article into the database
      db.serialize(() => {
        response.data.articles.forEach((article) => {
          const url = article.url;
          // hash the url to get a unique id
          const id = createHash(url);
          // check if the article already exists in the database
          db.get("SELECT * FROM news WHERE id = ?", [id], (err, row) => {
            if (err) {
              console.log(err);
              res.status(500).json({ error: err.message });
              return;
            }
            if (row) {
              count -= 1;
              return;
            }
            // if the article does not exist, insert it into the database
            if (!row) {
              db.run(
                "INSERT INTO news (id, title, description, content, url, urlToImage, publishedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                  id,
                  article.title,
                  article.description,
                  article.content,
                  article.url,
                  article.urlToImage,
                  article.publishedAt,
                ],
                (err) => {
                  if (err) {
                    console.log(err);
                    res.status(500).json({ error: err.message });
                    count -= 1;
                    return;
                  }
                }
              );
            }
          });
        });
      });

      if (fetched_pages * 100 >= response.data.totalResults) {
        fetched_pages = 0;
      }

      res.status(200).json({ message: "Database updated" });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error: error.message });
    });
});

// Subscribe to the newsletter
router.post("/subscribe", (req, res, next) => {
  const email = req.body.email;
  try {
    db.run(
      "CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY)",
      (err) => {
        if (err) {
          console.log(err);
          res.status(500).json({ error: err.message });
          return;
        }
      }
    );

    // Check if the email already exists in the database
    db.get("SELECT * FROM subscribers WHERE email = ?", [email], (err, row) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
        return;
      }
      if (row) {
        res.status(201).json({ message: "You are already subscribed" });
        return;
      }
      if (!row) {
        db.run("INSERT INTO subscribers (email) VALUES (?)", [email], (err) => {
          if (err) {
            console.log(err);
            res.status(500).json({ error: err.message });
            return;
          }
          res.status(200).json({ message: "You are now subscribed" });
        });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a single news item
router.delete("/news/:id", (req, res, next) => {
  db.run("DELETE FROM news WHERE id = ?", [req.params.id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(200).json({ message: "News item deleted" });
  });
});

// DELETE all news items
router.delete("/news", (req, res, next) => {
  db.run("DELETE FROM news", (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(200).json({ message: "All news items deleted" });
  });
});

// Unsubscribe from the newsletter
router.delete("/unsubscribe", (req, res, next) => {
  const email = req.body.email;
  try {
    db.run("DELETE FROM subscribers WHERE email = ?", [email], (err) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(200).json({ message: "You are now unsubscribed" });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
