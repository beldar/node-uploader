const knox = require('knox');

const App = {
  init() {
    this.dropzone = document.getElementById('dropzone');
    this.getname = document.getElementById('getname');
    this.wrapper = document.getElementById('wrapper');

    if (localStorage.getItem('username')) {
      this.username = localStorage.getItem('username');
    } else {
      this.username = false;
    }

    this.setUpS3();
    this.show();
  },

  setUpS3() {
    this.client = knox.createClient({
        key: ''
      , secret: ''
      , bucket: 'boda-marti-anna'
    });
  },

  show() {
    if (this.username) {
      this.getname.classList.remove('show');
      this.dropzone.classList.add('show');
      this.wrapper.classList.add('dropzone');
      this.setDropzone();
    } else {
      this.dropzone.classList.remove('show');
      this.getname.classList.add('show');
      this.wrapper.classList.remove('dropzone');
      this.setGetname();
    }
  },

  setGetname() {
    this.button = document.getElementById('save');
    this.input = document.getElementById('username');

    this.button.addEventListener('click', () => {
      if (this.input.value !== '') {
        localStorage.setItem('username', this.input.value);
        this.username = this.input.value;
        this.show();
      }
    });
  },

  setDropzone() {
    this.wrapper.addEventListener('dragenter', () => this.wrapper.classList.add('enter'));
    this.wrapper.addEventListener('dragleave', () => this.wrapper.classList.remove('enter'));
    this.wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.wrapper.classList.remove('enter');
      return false;
    });

    this.wrapper.addEventListener('drop', (e) => {
      e.preventDefault();

      let files = e.target.files || e.dataTransfer.files;

      this.files = files;

      this.uploadFiles();

      return false;

    });
  },

  uploadFiles() {
    let files = this.files;

    for (var i = 0; i < files.length; i++) {
        file = files[i];
        this.uploadFile(file);
        console.log(file);
    }
  },

  uploadFile(file) {
    if (! this.username) return;

    let path = this.username.trim().replace(' ', '-') + '/' + file.name.trim().replace(' ', '-');

    console.log('Upload to: ' + path);

    let req = this.client.putFile(file.path, path, function(err, res){
      // Always either do something with `res` or at least call `res.resume()`.
      if (err) {
        console.error('Error', err);
      } else {
        console.log(res)
      }
    });

    req.on('progress', (e) => console.log(e))
  }
};

App.init();
