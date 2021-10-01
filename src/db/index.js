const { unlink } = require('fs');

class Database {
  constructor() {
    this.db = {};
  }

  add(id, obj) {
    this.db[id] = obj;
  }

  getById(id) {
    return this.db[id];
  }

  deleteById(id) {
    if (this.db[id]) {
      const filepath = this.db[id].path;
      unlink(filepath, (err) => {
        if (err) {
          console.log('cannot delete file: ', filepath);
        }
      });
      delete this.db[id];
      return true;
    } else {
      return false;
    }
  }

  foreach(cb) {
    for (let key in this.db) {
      cb(this.db[key]);
    }
  }
}

module.exports = Database;
