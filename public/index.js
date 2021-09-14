let transactions = [];
let myChart;

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
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
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
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

async function saveRecord (transaction) {
    // fetch failed, so save in indexed db
    //Here is where we write offline records to indexeddb
    console.log ('*******************************');
    console.log ('***********saveRecord**********');
    console.log ('*******************************');
    const trxn = offlineDB.transaction("transactions", "readwrite");
    const store = trxn.objectStore("transactions");

    await store.put(transaction);
}

async function uploadOffline() {
  const trxn = offlineDB.transaction("transactions", "readwrite");
  const store = trxn.objectStore("transactions");

  let transactions = await store.getAll();
  let nextRec;

  transactions.onsuccess = function() {
    console.log ('***********TRXNS***************');
    console.log ('***********TRXNS***************');
    console.log ('***********TRXNS***************');
    console.log (transactions.result);
    console.log (transactions.result.length);
    console.log ('***********TRXNS***************');
    console.log ('***********TRXNS***************');
    console.log ('***********TRXNS***************');

    for (let i = 0; i < transactions.result.length; i++) {
      // Creates Record to Write
    console.log ('***********DETAIL***************');
    console.log ('***********DETAIL***************');
    console.log ('***********DETAIL***************');
    console.log ("name  : " + transactions.result[i].name);
    console.log ("value : " + transactions.result[i].value);
    console.log ("date  : " + transactions.result[i].date);
    console.log ('***********DETAIL***************');
    console.log ('***********DETAIL***************');
    console.log ('***********DETAIL***************');
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
    }
  };
}