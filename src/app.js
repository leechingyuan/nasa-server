const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const api = require('./routes/api');

const app = express();

// allow cross origin query from client
app.use(cors({
    origin: 'http://localhost:3000'
}));

// for logging
app.use(morgan('combined'));

app.use(express.json()); // convert to JSON if body is in JSON
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/v1', api); // can support multiple versions

app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;