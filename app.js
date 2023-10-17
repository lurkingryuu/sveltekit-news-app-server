const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const api = require('./routes/api');
const cors = require('cors');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// use cors
app.use(cors());

app.use('/api', api);


const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";
app.listen(
    port,
    host,
    () => console.log(`Server listening at http://${host}:${port}`)
);

module.exports = app;
