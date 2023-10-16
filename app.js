const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const api = require('./routes/api');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// use cors
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // * = allow all domains
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );
    res.setHeader(
        // allow these methods
        'Access-Control-Allow-Methods',
        'GET, POST, PATCH, DELETE, OPTIONS'
    );
    next();
    }
);

app.use('/api', api);


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}...`));

module.exports = app;
