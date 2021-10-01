const express = require('express');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const { createReadStream } = require('fs');
const { replaceBackground } = require('backrem');
const { nanoid } = require('nanoid');
const Database = require('./db');

const app = express();
const port = 8080;

const db = new Database();

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'assets');
  },
  filename: function (req, file, callback) {
    console.log(file);
    callback(null, nanoid() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    console.log('File not received');
    return res.sendStatus(400);
  } else {
    const dbEntry = {
      id: req.file.filename.split('.')[0],
      uploadedAt: Date.now(),
      size: req.file.size,
      mimeType: req.file.mimetype,
      path: req.file.path,
    };

    db.add(dbEntry.id, dbEntry);
    return res.send(dbEntryToResponse(dbEntry));
  }
});

app.get('/list', (req, res) => {
  const listRes = [];
  db.foreach((elem) => {
    listRes.push(dbEntryToResponse(elem));
  });

  res.send(listRes);
});

app.get('/image/:id', (req, res) => {
  const dbobj = db.getById(req.params.id);
  if (dbobj && dbobj.path) {
    res.download(dbobj.path, path.basename(dbobj.path), (err) => {
      if (err) {
        console.log('error while downloading file: ', err);
      }
    });
  } else {
    res.sendStatus(400);
  }
});

app.delete('/image/:id', (req, res) => {
  if (db.deleteById(req.params.id)) {
    res.end();
  } else {
    res.status(400).end();
  }
});

app.get('/merge', async (req, res) => {
  const { front, back, color, threshold } = req.query;

  let colors = [255, 255, 255];
  if (color) {
    try {
      colors = color.split(',').map((i) => parseInt(i));
    } catch (e) {
      // Ignore: use default
    }
  }

  let thresholdNum = 0;
  if (threshold) {
    try {
      thresholdNum = parseInt(threshold);
    } catch (e) {
      // Ignore: use default
    }
  }

  const frontObj = db.getById(front);
  if (!frontObj || !frontObj.path) {
    res.status(400).send({ error: 'front object must exist' });
    return;
  }

  const backObj = db.getById(back);
  if (!backObj || !backObj.path) {
    res.status(400).send({ error: 'back object must exist' });
    return;
  }

  //   frontObj = {path: 'assets/S2YnSak84nGPGwosjldT-.jpg', mimeType: "image/jpg"}
  //   backObj = {path: 'assets/sb2DWcibRCjS89efEYL2i.jpg'}

  const frontStr = createReadStream(
    path.resolve(__dirname, '..', frontObj.path)
  );
  const backStr = createReadStream(path.resolve(__dirname, '..', backObj.path));

  res.setHeader('Content-type', frontObj.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=merged${path.extname(frontObj.path)}`
  );

  const rstream = await replaceBackground(
    frontStr,
    backStr,
    colors,
    thresholdNum
  );
  rstream.pipe(res);
});

// DEBUG
app.get('/debug/db', (req, res) => {
  db.foreach((elem) => {
    console.log(elem);
  });
  res.send({});
});
app.get('/debug/upload', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(
    '<form action="/upload" method="post" enctype="multipart/form-data">'
  );
  res.write('<input type="file" name="image"><br>');
  res.write('<input type="submit">');
  res.write('</form>');
  return res.end();
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// Send to user only selected fields, omit others
function dbEntryToResponse({ id, mimeType, uploadedAt, size }) {
  return { id, mimeType, uploadedAt, size };
}
