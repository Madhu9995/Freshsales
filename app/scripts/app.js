function handleError(err) {
  logErrorToService(err);
  console.error("An error occurred:", err);
}

function logErrorToService(error) {
  console.error('Logging error to service:', error);
}

document.onreadystatechange = function () {
  if (document.readyState === 'interactive') {
    var onInit = app.initialized();
    onInit
      .then(function (_client) {
        window.client = _client;
        onAppInitialize();
      })
      .catch(function (error) {
        handleError(error);
      });
  } else {
    handleError(document.readyState);
  }

};

let originalData = [];
const avatar = document.getElementById('avatar');
const signoutModal = document.getElementById('signout-modal');
const confirmSignoutBtn = document.getElementById('confirm-signout');
const cancelSignoutBtn = document.getElementById('cancel-signout');
const searchInput = document.getElementById('searchInput');



async function onAppInitialize() {
  try {
    let userDetails = await client.request.invokeTemplate("getUserDetails", {});
    // console.log(JSON.parse(userDetails.response));

    if (userDetails.status === 200) {
      const { id, account_id, first_name, last_name } = JSON.parse(userDetails.response || '{}') || null;
      // const { , last_name } = JSON.parse(userDetails.response || '{}');

      // Set avatar values
      if (first_name && last_name) {
        const initials = first_name.charAt(0).toUpperCase() + last_name.charAt(0).toUpperCase();
        // const avatar = document.getElementById('avatar');
        avatar.setAttribute('initials', initials);
      }
      else {
        const initials = `UK`;
        avatar.setAttribute('initials', initials);
      }
      getWebinarResponse(id, account_id);
    }
    else {
      console.error(`Error fetching user details: ${userDetails.status}`);
      return;
    }
  } catch (error) {
    handleError(error);
    const initials = `UK`;
    avatar.setAttribute('initials', initials);
  }
}

async function getWebinarResponse(id, account_id) {
  try {
    if (id) {
      const webinarResponse = await client.request.invokeTemplate("listWebinars", {
        context: {
          userId: id,
        },
      });

      const webinarDetails = JSON.parse(webinarResponse.response);
      if (webinarResponse.status === 200) {
        listWebinars(webinarDetails, account_id);
        originalData = webinarDetails.webinars;
      }
      else {
        let error_msg = webinarResponse.status;
        console.error(error_msg, "Error while fetching")
        return;
      }
    }
    else {
      let error_msg = "Id coudln't fetch"
      console.error(error_msg);
    }
  } catch (error) {
    const initials = `UK`;
    avatar.setAttribute('initials', initials);
    handleError(error);
  }
}

!!signoutModal && signoutModal.addEventListener('fwSubmit', () => {
  // signOut();
  client.interface.trigger('reAuthorize');
});

!!avatar && avatar.addEventListener('click', function () {
  signoutModal.open();
});

!!confirmSignoutBtn && confirmSignoutBtn.addEventListener('click', () => signoutModal.close());

!!cancelSignoutBtn && cancelSignoutBtn.addEventListener('click', () => signoutModal.close());

!!searchInput && searchInput.addEventListener('input', function () {
  const searchValue = searchInput.value.toLowerCase();
  const filteredData = originalData.filter(row => {
    return (
      row.topic.toLowerCase().includes(searchValue) ||
      row.id.toString().includes(searchValue)
    );
  });
  listWebinars(filteredData);
});

let currentPage = 1;
let itemsPerPage = 5;

async function listWebinars(webinarDetails, account_id) {
  //  let webinarDetails_backup = webinarDetails;
  // let account_id_backup = account_id;
  // let webinarLists_backup = webinarDetails.webinars;
  let webinarLists = webinarDetails.webinars;
  const tableBody = document.querySelector("#webinarTable tbody");
  tableBody.innerHTML = "";

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedWebinars = webinarLists.slice(start, end);

  let syncData = [];

  syncData = await getExistingWebinarsFromEntity('webinarEssentials', account_id);
  // console.log("syncData", syncData);

  paginatedWebinars.forEach((webinar) => {
    const row = document.createElement("tr");

    // Webinar Name
    const webinarNameCell = document.createElement("td");
    const webinarLink = document.createElement("a");
    webinarLink.textContent = webinar.topic;
    webinarLink.href = "#";
    webinarLink.style.color = '#007bff';
    webinarLink.style.textDecoration = 'underline';

    // Check if the webinar has ended or not
    const webinarStartTime = new Date(webinar.start_time);
    const webinarEndTime = new Date(webinarStartTime.getTime() + webinar.duration * 60000);
    const currentTime = new Date();

    webinarLink.addEventListener('click', () => {
      if (currentTime > webinarEndTime) {
        openWebinarModal(webinar.id, webinar.topic, 'isEnded');
      } else {
        openWebinarModal(webinar.id, webinar.topic, 'isNotEnded');
        // console.log("The webinar is still ongoing or has not started yet. No participants to show.");
      }
    });

    webinarNameCell.appendChild(webinarLink);
    row.appendChild(webinarNameCell);

    // Webinar ID
    const webinarIdCell = document.createElement("td");
    webinarIdCell.textContent = webinar.id;
    row.appendChild(webinarIdCell);

    // Scheduled Date
    const scheduledDateCell = document.createElement("td");
    scheduledDateCell.textContent = formatDateWithTime(webinar.start_time);
    row.appendChild(scheduledDateCell);

    // Last Sync - Retrieve from DB if available
    const lastSyncCell = document.createElement("td");
    const dbRecord = syncData.find(record => record.data.webinarId == webinar.id);
    lastSyncCell.textContent = dbRecord
      ? formatDateWithTime(dbRecord.data.lastSyncTime)
      : "Never Synced";
    row.appendChild(lastSyncCell);

    // Sync
    const syncStatusCell = document.createElement("td");
    const syncIcon = document.createElement("fw-icon");
    syncIcon.setAttribute("name", "sync");
    syncIcon.setAttribute("color", "#007bff");
    syncIcon.style.cursor = 'pointer';
    syncIcon.classList.add("sync-icon");
    syncStatusCell.appendChild(syncIcon);
    row.appendChild(syncStatusCell);

    tableBody.appendChild(row);
  });

  await createCustomFields();
  attachSyncButtonListeners(account_id, webinarLists);

  updatePaginationControls(webinarLists.length);
}

const paginationState = {
  currentPage: 1,
  itemsPerPage: 5,
  accountIdBackup: null,
  webinarDetailsBackup: []
};

function updatePaginationControls(totalItems) {
  const totalPages = Math.ceil(totalItems / paginationState.itemsPerPage);
  document.getElementById("pageIndicator").innerText = `Page ${paginationState.currentPage} of ${totalPages}`;
  document.getElementById("prevPage").disabled = paginationState.currentPage === 1;
  document.getElementById("nextPage").disabled = paginationState.currentPage === totalPages;
}

document.getElementById("itemsPerPage").addEventListener("change", function () {
  paginationState.itemsPerPage = parseInt(this.value);
  paginationState.currentPage = 1;
  listWebinars(paginationState.webinarDetailsBackup, paginationState.accountIdBackup);
});

document.getElementById("prevPage").addEventListener("click", function () {
  if (paginationState.currentPage > 1) {
    paginationState.currentPage--;
    listWebinars(paginationState.webinarDetailsBackup, paginationState.accountIdBackup);
  }
});

document.getElementById("nextPage").addEventListener("click", function () {
  const totalItems = paginationState.webinarDetailsBackup.length; // Assuming you have this array populated
  if (paginationState.currentPage < Math.ceil(totalItems / paginationState.itemsPerPage)) {
    paginationState.currentPage++;
    listWebinars(paginationState.webinarDetailsBackup, paginationState.accountIdBackup);
  }
});

async function createCustomFields() {
  try {
    const customFields = [
      {
        internal_name: "last_registered_zoom_webinar",
        set_default_value: "false",
        label: "Last registered Zoom webinar",
        type: "text",
        editable: true,
        position: 0,
        visible: true,
        required: false
      },
      {
        internal_name: "total_number_of_zoom_webinar_registrations",
        set_default_value: "false",
        label: "Total number of Zoom webinar registrations",
        type: "decimal",
        editable: true,
        position: 0,
        visible: true,
        required: false
      },
      {
        internal_name: "total_number_of_zoom_webinars_attended",
        set_default_value: "false",
        label: "Total number of Zoom webinars attended",
        type: "decimal",
        editable: true,
        position: 0,
        visible: true,
        required: false
      }
    ];

    client.request.invoke("customFieldCreation", { customFields })
      .then(
        function (data) {
          console.log("Server method Request ID is: " + data.requestID);
          console.log("Server method response is: " + JSON.stringify(data));
        },
        function (err) {
          console.log("Request ID: " + JSON.stringify(err));
          console.log("error status: " + err.status);
          console.log("error message: " + err.message);
        })
      .catch(function (error) {
        handleError(error);
      })

  } catch (error) {
    console.log(`Error creating custom field :`, error);
  }
}

async function getExistingWebinarsFromEntity(entityName, account_id) {
  const entity = client.db.entity({ version: "v1" });
  try {
    const entityRef = await entity.get(entityName);
    const records = await entityRef.getAll();
    console.log("account_id", account_id, records)
    return records.records || [];
  } catch (error) {
    console.error(`Error retrieving records from ${entityName}:`, error);
    return [];
  }
}

// function attachSyncButtonListeners(account_id, webinarLists) {
//   const syncIcons = document.querySelectorAll(".sync-icon");
//   syncIcons.forEach((button) => {
//     button.addEventListener("click", (event) => {
//       const row = event.target.closest("tr");
//       const webinarId = row.children[1].textContent;
//       const webinarName = row.children[0].textContent;
//       const lastSyncCell = row.children[3];
//       const syncStatusCell = row.children[4];
//       syncWebinarParticipants(webinarId, lastSyncCell, syncStatusCell, button, webinarName, account_id, webinarLists);
//     });
//   });
// }

document.addEventListener("click", (event) => {
  if (event.target.classList.contains("sync-icon")) {
    const button = event.target;
    const row = button.closest("tr");
    const webinarId = row.children[1].textContent;
    const webinarName = row.children[0].textContent;
    const lastSyncCell = row.children[3];
    const syncStatusCell = row.children[4];
    syncWebinarParticipants(webinarId, lastSyncCell, syncStatusCell, button, webinarName, paginationState.accountIdBackup, paginationState.webinarDetailsBackup);
  }
});

async function syncWebinarParticipants(webinarId, lastSyncCell, syncStatusCell, syncButton, webinarName, account_id, webinarLists) {
  try {
    syncButton.disabled = true;
    lastSyncCell.textContent = "Syncing...";

    const participantsList = await getWebinarParticipants(webinarId);
    if (participantsList.length > 0) {
      await searchParticipantsInFreshworks(participantsList, syncStatusCell, webinarId, webinarName, account_id, webinarLists);
      const lastSyncDate = new Date();
      lastSyncCell.textContent = formatDateWithTime(lastSyncDate);
    } else {
      const existingRecord = await filterEntityRecord('webinarEssentials', account_id, webinarId)
      if (existingRecord.length > 0) {
        const existingDisplayId = existingRecord[0].display_id;
        const existingRecordData = existingRecord[0].data;
        existingRecordData.lastSyncTime = "No participants/Registrants to Sync";
        await updateEntityRecord('webinarEssentials', existingDisplayId, existingRecordData);
      }
      else {
        await storeEntityRecord("webinarEssentials", {
          accountId: account_id,
          webinarId: webinarId,
          webinarName: webinarName,
          lastSyncTime: "No participants/Registrants to Sync"
        });
      }
      lastSyncCell.textContent = "No participants/Registrants to Sync";

    }
  } catch (error) {
    console.error("Failed to sync participants:", error);
    lastSyncCell.textContent = "Sync Failed, Try again!";
    return;
  } finally {
    syncButton.disabled = false;
  }
}

async function getWebinarParticipants(webinarId) {
  try {
    const participantResponse = await client.request.invokeTemplate("listWebinarParticipants", { context: { webinarId } });
    const registrantsResponse = await client.request.invokeTemplate("listWebinarRegistrants", { context: { webinarId } });

    if (participantResponse.status === 200 && registrantsResponse.status === 200) {
      const participants = JSON.parse(participantResponse.response).participants;
      const registrants = JSON.parse(registrantsResponse.response).registrants;

      const combinedList = [...participants, ...registrants];

      // const existedEmail = new Set();
      const mappedList = combinedList.reduce((acc, obj) => {
        const email = obj.user_email || obj.email;

        // if (!existedEmail.has(email)) {
        //   existedEmail.add(email);

        acc.push({
          id: obj.id || "",
          user_id: obj.user_id || "",
          name: obj.name || `${obj.first_name} ${obj.last_name}`.trim(),
          user_email: email,
          join_time: obj.join_time || "",
          leave_time: obj.leave_time || "",
          duration: obj.duration || 0,
          registrant_id: obj.registrant_id || "",
          failover: obj.failover || false,
          status: obj.status || "in_meeting",
          groupId: obj.groupId || ""
        });
        //  }

        return acc;
      }, []);

      return mappedList;
    }
  } catch (error) {
    console.error("Error fetching webinar participants:", error);
    return [];
  }
}

async function searchParticipantsInFreshworks(participantsList, syncStatusCell, webinarId, webinarName, account_id, webinarLists) {

  const webinarURL = webinarLists.find((webinar) => webinar.id == webinarId)?.join_url || '';

  for (const participant of participantsList) {
    const email = participant.user_email;
    // console.log(`Searching Freshworks CRM for participant with email: ${email}`);

    try {
      checkContact(email, webinarURL, webinarName, participant);
      const existingRecord = await filterEntityRecord('webinarEssentials', account_id, webinarId);
      if (existingRecord.length > 0) {
        const existingDisplayId = existingRecord[0].display_id;
        const existingRecordData = existingRecord[0].data;
        existingRecordData.lastSyncTime = new Date().toISOString();
        await updateEntityRecord('webinarEssentials', existingDisplayId, existingRecordData);
      } else {
        await storeEntityRecord("webinarEssentials", {
          accountId: account_id,
          webinarId: webinarId,
          webinarName: webinarName,
          lastSyncTime: new Date().toISOString()
        });
      }

      console.log(`Stored sync time for newly created contact: ${participant.user_email}`);
    } catch (error) {
      console.error(`Error processing ${email}:`, error);
      return;
    }
  }
  // console.log(`Sync completed for Webinar ID: ${webinarId}\n${foundCount} of ${participantsList.length} participants processed successfully.`);
}

async function checkContact(email, webinarURL, webinarName, participant, foundCount) {
  try {
    const response = await client.request.invokeTemplate("contact_check", {
      context: { email: email }
    });

    // if (response.status !== 200) {
    //   console.error(`Error checking contact for ${email}: ${response.message}`);
    // }

    const contactData = JSON.parse(response.response);
    // console.log('Contact data:', contactData);
    viewContact(contactData, webinarURL, webinarName, participant, foundCount);

  } catch (error) {
    handleError(error);
  }
}

async function viewContact(contactData, webinarURL, webinarName, participant, foundCount) {
  try {
    if (contactData && contactData.length > 0) {
      const contactId = contactData[0].id;
      const contactDetails = await client.request.invokeTemplate("view_contact", {
        context: { contactId: contactId }
      });
      // console.log("ViewContact :", JSON.parse(contactDetails.response))
      const existingContact = JSON.parse(contactDetails.response).contact;

      const latestWebinarRegistered = existingContact.custom_field.cf_total_number_of_zoom_webinar_registrations || 0;
      const totalRegistrations = existingContact.custom_field.cf_total_number_of_zoom_webinar_registrations || 0;
      const totalAttended = existingContact.custom_field.cf_total_number_of_zoom_webinars_attended || 0;
      if (latestWebinarRegistered !== `${webinarName} (${webinarURL})`) {
        const fieldsToUpdate = {
          "cf_last_registered_zoom_webinar": `${webinarName} (${webinarURL})`,
          "cf_total_number_of_zoom_webinar_registrations": participant.join_time === "" ? totalRegistrations + 1 : totalRegistrations,
          "cf_total_number_of_zoom_webinars_attended": participant.join_time !== "" ? totalAttended + 1 : totalAttended
        };

        updateContact(fieldsToUpdate, contactId);
      }
      foundCount++;
    } else {
      await addContactInFreshworks(participant);
    }
    console.log(foundCount, "FoundCount");
  }
  catch (error) {
    handleError(error);
  }
}

async function updateContact(fieldsToUpdate, contactId) {
  try {

    const body = {
      contact: {
        custom_field: fieldsToUpdate
      }
    };

    const updateResponse = await client.request.invokeTemplate("update_contact", {
      context: { id: contactId },
      body: JSON.stringify(body)
    });

    if (updateResponse.status === 200) {
      console.log(`Successfully updated custom fields for contact ID: ${contactId}`, updateResponse);
    } else {
      console.error(`Failed to update custom fields for contact ID: ${contactId}`);
      return;
    }
  }
  catch (error) {
    handleError(error);
  }
}

async function addContactInFreshworks(participant) {
  const { name } = participant;
  const [first_name, last_name] = name.split(" ");

  const body = {
    contact: {
      first_name: first_name || '',
      last_name: last_name || '',
      mobile_number: participant.mobile_number || '',
      email: participant.user_email || ''
    }
  };

  try {
    const response = await client.request.invokeTemplate("create_contact", {
      body: JSON.stringify(body)
    });
    console.log(response);

    // if (response.status !== 200) {
    //   console.error(`Error creating contact for ${participant.user_email}: ${response.message}`);
    // } else {
    //   console.log(`Successfully created contact for ${participant.user_email}`);
    // }
  } catch (error) {
    console.error('Error in addContact:', error);
    return;
  }
}

async function openWebinarModal(webinarId, webinarTopic, webinarState) {
  try {
    let registrantsResponse;
    let participantsResponse;
    const modal = document.getElementById('webinar-modal');
    modal.titleText = webinarState === 'isEnded' ? webinarTopic + '(' + webinarId + ')' : webinarTopic + '(' + webinarId + ') - Not Started Yet'
    modal.open();

    registrantsResponse = await client.request.invokeTemplate("listWebinarRegistrants", {
      context: {
        webinarId: webinarId
      }
    });

    // console.log("webinarState", webinarState)
    if (webinarState === 'isEnded') {
      await client.request.invokeTemplate("listWebinarParticipants", {
        context: {
          webinarId: webinarId
        }
      }).then((res) => {
        participantsResponse = res;
      }).catch((err) => {
        console.error(err);
        participantsResponse = null;
      })
    }
    else {
      participantsResponse = null;
    }

    if (registrantsResponse.status === 200) {
      const registrants = JSON.parse(registrantsResponse.response).registrants;

      if (participantsResponse) {
        const participants = JSON.parse(participantsResponse.response).participants;
        renderRegistrantsTable(registrants);
        renderParticipantsTable(participants);
      }
      else {
        renderRegistrantsTable(registrants);
        renderParticipantsTable([]);
      }

    } else {
      console.error("Failed to fetch registrants or participants");
      return;
    }
  } catch (error) {
    console.error("Error fetching webinar data:", error);
    return;
  }
}

function renderRegistrantsTable(registrants) {
  // console.log("registrants", registrants)
  const registrantsTableBody = document.querySelector("#registrantsTable tbody");
  registrantsTableBody.innerHTML = "";

  if (registrants.length > 0) {
    registrants.forEach((registrant) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = `${registrant.first_name} ${registrant.last_name}`;
      row.appendChild(nameCell);

      const emailCell = document.createElement("td");
      emailCell.textContent = registrant.email == '' ? '-' : registrant.email;
      row.appendChild(emailCell);

      const regTimeCell = document.createElement("td");
      regTimeCell.textContent = registrant.create_time == '' ? '-' : formatDateWithTime(registrant.create_time);
      row.appendChild(regTimeCell);

      registrantsTableBody.appendChild(row);
    });
  }
  else {
    const noRegistrantsRow = document.createElement("tr");
    const noRegistrantsCell = document.createElement("td");
    noRegistrantsCell.colSpan = 3;
    noRegistrantsCell.textContent = "No Registrants";
    noRegistrantsRow.appendChild(noRegistrantsCell);
    registrantsTableBody.appendChild(noRegistrantsRow);
  }
}

function renderParticipantsTable(participants) {
  // console.log("participants", participants);
  const participantsTableBody = document.querySelector("#participantsTable tbody");
  participantsTableBody.innerHTML = "";

  if (participants.length > 0) {
    participants.forEach((participant) => {
      const nameCell = document.createElement("td");
      nameCell.textContent = participant.name;

      const emailCell = document.createElement("td");
      emailCell.textContent = participant.user_email === '' ? '-' : participant.user_email;

      const joinTimeCell = document.createElement("td");
      joinTimeCell.textContent = formatDateWithTime(participant.join_time);

      const leaveTimeCell = document.createElement("td");
      leaveTimeCell.textContent = formatDateWithTime(participant.leave_time);

      const viewTimeCell = document.createElement("td");

      const joinTime = new Date(participant.join_time);
      const leaveTime = new Date(participant.leave_time);
      const timeDifference = leaveTime - joinTime;

      if (!isNaN(timeDifference) && timeDifference > 0) {
        const minutes = Math.floor(timeDifference / 60000);
        const seconds = Math.floor((timeDifference % 60000) / 1000);
        viewTimeCell.textContent = `${minutes} mins ${seconds} secs`;
      } else {
        viewTimeCell.textContent = '-';
      }

      const row = document.createElement("tr");
      row.appendChild(nameCell);
      row.appendChild(emailCell);
      row.appendChild(joinTimeCell);
      row.appendChild(leaveTimeCell);
      row.appendChild(viewTimeCell);
      participantsTableBody.appendChild(row);
    });
  } else {
    const noParticipantsRow = document.createElement("tr");
    const noParticipantsCell = document.createElement("td");
    noParticipantsCell.colSpan = 5;
    noParticipantsCell.textContent = "No Participants";
    noParticipantsRow.appendChild(noParticipantsCell);
    participantsTableBody.appendChild(noParticipantsRow);
  }
}

function closeModal() {
  const modal = document.getElementById('webinar-modal');
  modal.close();
}

// function signOut() {
//   client.interface.trigger('reAuthorize');
// }

function formatDateWithTime(date) {
  if (isNaN(Date.parse(date))) {
    return date;
  }
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

async function storeEntityRecord(entityName, record) {
  const entity = client.db.entity({ version: "v1" });
  const entityRef = await entity.get(entityName);

  entityRef.create(record)
    .then(function (data) {
      // let record_data = data;
      // console.log("Record added successfully:", record_data);
      console.log(data);
    })
    .catch(function (error) {
      let error_msg = error;
      console.error("Error adding record:", error_msg);
      return;
    })
}

async function filterEntityRecord(entityName, account_id, webinarId) {
  return new Promise(async (resolve, reject) => {
    try {
      const entity = client.db.entity({ version: "v1" });
      const entityRef = await entity.get(entityName);

      entityRef.getAll({
        query: {
          $and: [
            { accountId: account_id },
            { webinarId: webinarId }
          ]
        }
      })
        .then(data => {
          // console.log("filtered record:", data);
          resolve(data.records);
        })
        .catch(err => {
          // console.log("error while filtering record:", err);
          reject(err);
        });
    } catch (error) {
      // console.log("error in filterEntityRecord:", error);
      reject(error);
    }
  });
}

async function updateEntityRecord(entityName, displayId, data) {
  const entity = client.db.entity({ version: "v1" });
  const entityRef = await entity.get(entityName);
  entityRef.update(displayId, data);
  // const res = entityRef.update(displayId, data);
  // console.log("update res :", res)
}

async function deleteEntityRecord(entityName, displayId) {
  const entity = client.db.entity({ version: "v1" });
  const entityRef = await entity.get(entityName);
  entityRef.delete(displayId);
  // const res = entityRef.delete(displayId);
  // console.log("delete res :", res)

}

async function retrieveEntity(entityName, recordid) {
  client.db.get(entityName, recordid)
    .then(function (record) {
      let user_details = record.user_details;
      console.log("User details", user_details);
    })
    .catch(function (err) {
      let error_msg = err
      console.error("Error details", error_msg);
      return;
    });
}
