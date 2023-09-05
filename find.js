const fs = require('fs');
const exec = require('child_process').exec;
const path = require('path');
const args = process.argv.slice(2);
const author = 'Dr. Kaan Gunduz';
const programname = 'gfind';
const version = '0.1';
console.clear();
console.log(`${programname} v${version} by ${author}`);
console.log('________________________________________________________________');
if (args.length !== 2) {
  console.log(
    'This program will search for a keyword in an image, recursively\n',
  );
  console.log('Usage: gfind.exe <folder> <keyword>');
  process.exit(1);
}

const folder = args[0];
const keyword = args[1];
console.log(`Searching for ${keyword} in ${folder}`);
let imagearray = [];

async function findFilesRecursive(folder) {
  //recursively find images in a folder
  //get all files in folder and subfolders
  const files = await fs.promises.readdir(folder);
  //filter out files that are not images
  const images = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    const f = ['.e01'].includes(ext);

    // console.log(path.join(folder, file));
    //return full path
    if (f) {
      imagearray.push(path.join(folder, file));
      return path.join(folder, file);
    }
  });

  //add images to array
  //   imagearray = imagearray.concat(images);
  //get all subfolders
  const subfolders = files.filter((file) => {
    const folders = fs.statSync(path.join(folder, file));
    return folders.isDirectory();
  });
  //for each subfolder, call findFilesRecursive
  for (const subfolder of subfolders) {
    await findFilesRecursive(path.join(folder, subfolder));
  }
  return imagearray;
}

const mmlsfunc = (image) => {
  const options = {
    encoding: 'utf8',
    timeout: 0,
    maxBuffer: 200 * 1024,
    killSignal: 'SIGTERM',
  };

  return new Promise((resolve, reject) => {
    exec(`mmls "${image}"`, options, (err, stdout, stderr) => {
      if (err) {
        resolve(err);
      }
      //get the lines that start with a number and :
      const lines = stdout.split('\n');
      const lines2 = lines.filter((line) => {
        return line.match(/^\d+:/);
      });
      //replace triple spaces with tab, then double spaces with tab
      let lines3 = lines2.map((line) => {
        return line.replace(/\s\s\s/g, '\t').replace(/\s\s/g, '\t');
      });
      //now we need the third and the 6th column
      lines3 = lines3
        .map((line) => {
          const linearray = line.split('\t');

          if (linearray[5].includes('NTFS')) {
            let offset = linearray[2];
            //convert offset to decimal
            offset = parseInt(offset);
            return offset + '@' + 'NTFS' + '@' + image;
          } else if (linearray[5].includes('FAT')) {
            let offset = linearray[2];
            //convert offset to decimal
            offset = parseInt(offset);
            return offset + '@' + 'FAT' + '@' + image;
          } else {
            return null;
          }
          //remove nulls
        })
        .filter((line) => {
          return line !== null;
        });
      resolve(lines3);
    });
  });
};

async function flsfunc(image, keyword) {
  const options = {
    encoding: 'utf8',
    timeout: 0,
    maxBuffer: 32 * 1024 * 1024,
    killSignal: 'SIGTERM',
  };
  const offset = image.split('@')[0];
  const fstype = image.split('@')[1].toLowerCase();
  const imagepath = image.split('@')[2];

  return new Promise((resolve, reject) => {
    let command = 'powershell.exe -command ';
    command += `"fls -o ${offset} -f ${fstype} -r  '${imagepath}' | Select-String ${keyword}"`;
    exec(command, options, (err, stdout, stderr) => {
      if (err) {
        resolve(err);
      }
      return resolve(stdout);
    });
  });
}

findFilesRecursive(folder).then((imagearray) => {
  //for each image, run findinimages
  for (const image of imagearray) {
    mmlsfunc(image).then((r) => {
      //for each partition, run fls
      for (const partition of r) {
        flsfunc(partition, keyword).then((r) => {
          let nope;
          console.log(image);
          console.log(partition);
          if (r !== '') {
            console.log(r);
          } else {
            console.log('No results');
            nope = 'No results';
          }
          //export to csv
          if (nope !== 'No results') {
            fs.appendFileSync('results.csv', `${image},${partition},${r}\n`);
          } else {
            fs.appendFileSync('results.csv', `${image},${partition},${nope}\n`);
          }
        });
      }
    });
  }
});
