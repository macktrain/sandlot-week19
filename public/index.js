let transactions = [];
let myChart;

//NOTE:  Drop mongo db at command line with:  mongo budget --eval "printjson(db.dropDatabase())"
//Offline DB
let offlineDB;
const request = indexedDB.open("budgetOffline");

request.onupgradeneeded = function() {
  // The database did not previously exist, so create object stores and indexes.
  offlineDB = request.result;
  const store = offlineDB.createObjectStore("transactions", {autoIncrement:true});

};

request.onsuccess = function() {
  offlineDB = request.result;
};

//LEEM:  This initial fetch pulls whats in the db and populates it on the UI
//       and is first called after index.html renders here: 
//       "<script src="index.js"></script>"
fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  console.log ('***************unshift**************');
  transactions.unshift(transaction);
  console.log (transactions);
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    //HERE we must write offline records to db and delete them
    uploadOffline();
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    console.log ('*******************************');
    console.log ('*************CATCH*************');
    console.log ('*******************************');
    transactions.shift();
    console.log (transactions);
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

function saveRecord (transaction) {
    // fetch failed, so save in indexed db
    //Here is where we write offline records to indexeddb
    const trxn = offlineDB.transaction("transactions", "readwrite");
    const store = trxn.objectStore("transactions");

    store.put(transaction);
}

async function uploadOffline() {
  const trxn = offlineDB.transaction("transactions", "readwrite");
  const store = trxn.objectStore("transactions");

  let transactions = await store.getAll();
  let nextRec;

  transactions.onsuccess = function() {
    console.log (transactions.result);
    console.log (transactions.result.length);

    for (let i = 0; i < transactions.result.length; i++) {
      // Creates Record to Write
    console.log ("name  : " + transactions.result[i].name);
    console.log ("value : " + transactions.result[i].value);
    console.log ("date  : " + transactions.result[i].date);
      nextRec = {
        name: transactions.result[i].name,
        value: transactions.result[i].value,
        date: transactions.result[i].date
      };

      fetch("/api/transaction", {
        method: "POST",
        body: JSON.stringify(nextRec),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      });
      console.log ("Added Offline indexedDB Record:")
      console.log (nextRec);
    }
    console.log ("Deleted All Offline indexedDB records")
    const req = store.clear();
    console.log (req);
  };
}