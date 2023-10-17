// Define all the routes for the API
const express = require("express");
const router = express.Router();
const axios = require("axios");
const dotenv = require("dotenv");
const crypto = require("crypto").createHash("sha256");
const fs = require("fs");

dotenv.config();

const root = fs.realpathSync(process.cwd());
const newsPath = fs.realpathSync(process.cwd() + "/db/news.json");
const emailsPath = fs.realpathSync(process.cwd() + "/db/emails.json");

function createHash(text) {
  return crypto.update(text).copy().digest("hex");
}

FETCH_URL =
  "https://newsapi.org/v2/top-headlines?" +
  "apiKey=" +
  process.env.API_KEY;

// GET all news items paginated
router.get("/news", (req, res, next) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 12;
  const offset = (page - 1) * limit;

  // db.all(
  //   "SELECT * FROM news ORDER BY publishedAt DESC LIMIT ? OFFSET ?",
  //   [limit, offset],
  //   (err, rows) => {
  //     if (err) {
  //       res.status(500).json({ error: err.message });
  //       return;
  //     }
  //     res.status(200).json(
  //       rows.map((row) => {
  //         return {
  //           img: row.urlToImage,
  //           title: row.title,
  //           description: row.description,
  //           content: row.content,
  //           url: row.url,
  //         };
  //       })
  //     );
  //   }
  // );

  fs.readFile(newsPath, "utf8", (err, data) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const news = JSON.parse(data);
    res.status(200).json(
      news.slice(offset, offset + limit).map((row) => {
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
  // db.get("SELECT * FROM news WHERE id = ?", [req.params.id], (err, row) => {
  //   if (err) {
  //     res.status(500).json({ error: err.message });
  //     return;
  //   }
  //   res.status(200).json({
  //     img: row.urlToImage,
  //     title: row.title,
  //     description: row.description,
  //     content: row.content,
  //     url: row.url,
  //   });
  // });

  fs.readFile(newsPath, "utf8", (err, data) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const news = JSON.parse(data);
    const row = news.find((row) => row.id === req.params.id);
    res.status(200).json({
      img: row.urlToImage,
      title: row.title,
      description: row.description,
      content: row.content,
      url: row.url,
    });
  });
});

// Refresh database with new data
router.post("/refresh", (req, res, next) => {
try {

  let count = 0;
  const page = req.query.page || 1;
  const country = req.query.country || "in";
  const category = req.query.category || "general";
  axios
    .get(FETCH_URL + "&page=" + page + "&country=" + country + "&category=" + category)
    .then((response) => {
      if (response.data.status !== "ok") {
        res.status(500).json({ error: "Error fetching data from News API" });
        return;
      }

      // create a new database if it does not exist
      fs.open(newsPath, "r", (err, fd) => {
        if (err) {
          fs.writeFile(newsPath, "[]", (err) => {
            if (err) {
              console.log(err);
              res.status(500).json({ error: err.message });
              return;
            }
          });
        }
      });

      // Insert each article into the database
      // db.serialize(() => {
      //   response.data.articles.forEach((article) => {
      //     const url = article.url;
      //     // hash the url to get a unique id
      //     const id = createHash(url);
      //     // check if the article already exists in the database
      //     db.get("SELECT * FROM news WHERE id = ?", [id], (err, row) => {
      //       if (err) {
      //         console.log(err);
      //         res.status(500).json({ error: err.message });
      //         return;
      //       }
      //       if (row) {
      //         count -= 1;
      //         return;
      //       }
      //       // if the article does not exist, insert it into the database
      //       if (!row) {
      //         db.run(
      //           "INSERT INTO news (id, title, description, content, url, urlToImage, publishedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      //           [
      //             id,
      //             article.title,
      //             article.description,
      //             article.content,
      //             article.url,
      //             article.urlToImage,
      //             article.publishedAt,
      //           ],
      //           (err) => {
      //             if (err) {
      //               console.log(err);
      //               res.status(500).json({ error: err.message });
      //               count -= 1;
      //               return;
      //             }
      //           }
      //         );
      //       }
      //     });
      //   });
      // });
      fs.readFile(newsPath, "utf8", (err, data) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        const news = JSON.parse(data);
        response.data.articles.forEach((article) => {
          const url = article.url;
          // hash the url to get a unique id
          const id = createHash(url);
          // check if the article already exists in the database
          const row = news.find((row) => row.id === id);
          if (row) {
            count -= 1;
            return;
          }
          // if the article does not exist, insert it into the database
          if (!row) {
            news.push({
              id,
              title: article.title,
              description: article.description,
              content: article.content,
              url: article.url,
              urlToImage: article.urlToImage,
              publishedAt: article.publishedAt,
            });
          }
        });

        fs.writeFile(newsPath, JSON.stringify(news), (err) => {
          if (err) {
            console.log(err);
            res.status(500).json({ error: err.message });
            return;
          }
        });
        res.status(200).json({ message: "Database updated" });
      });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).json({ error: error.message });
    });
}
catch (error) {
  console.log(error);
  res.status(500).json({ error: error.message });
}
});

// Subscribe to the newsletter
router.post("/subscribe", (req, res, next) => {
  const email = req.body.email;
  try {
    // db.run(
    //   "CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY)",
    //   (err) => {
    //     if (err) {
    //       console.log(err);
    //       res.status(500).json({ error: err.message });
    //       return;
    //     }
    //   }
    // );

    // create a new database if it does not exist
    fs.open(emailsPath, "r", (err, fd) => {
      if (err) {
        fs.writeFile(emailsPath, "[]", (err) => {
          if (err) {
            console.log(err);
            res.status(500).json({ error: err.message });
            return;
          }
        });
      }
    });

    // Check if the email already exists in the database
    // db.get("SELECT * FROM subscribers WHERE email = ?", [email], (err, row) => {
    //   if (err) {
    //     console.log(err);
    //     res.status(500).json({ error: err.message });
    //     return;
    //   }
    //   if (row) {
    //     res.status(201).json({ message: "You are already subscribed" });
    //     return;
    //   }
    //   if (!row) {
    //     db.run("INSERT INTO subscribers (email) VALUES (?)", [email], (err) => {
    //       if (err) {
    //         console.log(err);
    //         res.status(500).json({ error: err.message });
    //         return;
    //       }
    //       res.status(200).json({ message: "You are now subscribed" });
    //     });
    //   }
    // });
    fs.readFile(emailsPath, "utf8", (err, data) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const emails = JSON.parse(data);
      const row = emails.find((row) => row.email === email);
      if (row) {
        res.status(201).json({ message: "You are already subscribed" });
        return;
      }
      if (!row) {
        emails.push({ email });
        fs.writeFile(emailsPath, JSON.stringify(emails), (err) => {
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
  // db.run("DELETE FROM news WHERE id = ?", [req.params.id], (err) => {
  //   if (err) {
  //     res.status(500).json({ error: err.message });
  //     return;
  //   }
  //   res.status(200).json({ message: "News item deleted" });
  // });

  fs.readFile(newsPath, "utf8", (err, data) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    const news = JSON.parse(data);
    const index = news.findIndex((row) => row.id === req.params.id);
    news.splice(index, 1);
    fs.writeFile(newsPath, JSON.stringify(news), (err) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(200).json({ message: "News item deleted" });
    });
  });
});

// DELETE all news items
router.delete("/news", (req, res, next) => {
  // db.run("DELETE FROM news", (err) => {
  //   if (err) {
  //     res.status(500).json({ error: err.message });
  //     return;
  //   }
  //   res.status(200).json({ message: "All news items deleted" });
  // });
  fs.writeFile(newsPath, "[]", (err) => {
    let password = req.body.password;
    if (err) {
      console.log(err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (password !== process.env.PASSWORD) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
    res.status(200).json({ message: "All news items deleted" });
  });
});

// Unsubscribe from the newsletter
router.delete("/unsubscribe", (req, res, next) => {
  const email = req.body.email;
  try {
    // db.run("DELETE FROM subscribers WHERE email = ?", [email], (err) => {
    //   if (err) {
    //     console.log(err);
    //     res.status(500).json({ error: err.message });
    //     return;
    //   }
    //   res.status(200).json({ message: "You are now unsubscribed" });
    // });
    fs.readFile(emailsPath, "utf8", (err, data) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      const emails = JSON.parse(data);
      const index = emails.findIndex((row) => row.email === email);
      emails.splice(index, 1);
      fs.writeFile(emailsPath, JSON.stringify(emails), (err) => {
        if (err) {
          console.log(err);
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(200).json({ message: "You are now unsubscribed" });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
