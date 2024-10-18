exports = {
  onAppInstallHandler: function (payload) {

    function handleError(err) {
      console.log("An error occured", err)
    }
    console.log("payload", JSON.stringify(payload))
    generateTargetUrl()
      .then(function (url) {
        console.log("URL:", url)
        //
      },
        function (err) {
          handleError(err);
          console.log("error :", err)
        });
    renderData();
  },
  onInvokeCheckHandler: function (args) {
    //console.log('Invoke check :', JSON.stringify(args));
    // console.log("Account Id :", args['data']['payload']['account_id'].toString())
    // console.log("Event Type :", args['data']['event'].toString());
    // console.log("Event Data :", JSON.stringify(args['data']['payload']));

    if (args['data']['event'].toString() === "webinar.participant_joined" || args['data']['event'].toString() === "webinar.registration_created") {
      updateCustomFieldValues(args.data)
    }

  },
  initialEventSubscription: async function () {
    try {
      console.log("Initial Event Subscription")
      const body = {
        events: [
          "meeting.created"
        ],
        event_subscription_name: "Example Event Subscription",
        event_webhook_url: "https://www.example.com",
        user_ids: [
          "_8KG7DeoRU2xIsDSY9ed2Q,90KG7DeoRU2xIsDSY9edwe"
        ],
        subscription_scope: "user",
        account_id: "pvg3UAgpRlyTDW-9sIpKcw"
      }
      const subscriptionResponse = await $request.invokeTemplate("EventSubscription", {
        body: JSON.stringify(body)
      });

      if (subscriptionResponse.status === 200) {
        console.log(`Event Created successfully`, subscriptionResponse);
      } else {
        console.error(`Failed to create event`, subscriptionResponse);
      }
    }
    catch (error) {
      console.log("Error in Initial Event Subscription", error)
    }

  },
  customFieldCreation: async function (args) {
    var res;
    try {
      const successRes = [];
      const fieldToSend = args.customFields;
      for (const field of fieldToSend) {
        try {
          const url = 'https://jetzerp-764021646700305537.myfreshworks.com/crm/sales/settings/contacts/forms/1/fields';
          const headers = {
            "Authorization": "Token token=SjTe4HRFUEQVFqR-xqY7Vg",
            "Content-Type": "application/json"
          };
          const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(field)
          });

          if (!response.ok) {
            res = response
          }
          const data = await response.json();
          successRes.push(data)

          const apiResponse = {
            status: "success",
            message: "Fields added successfully",
            data: successRes
          };
          res = apiResponse;
        }
        catch (err) {
          res = err
        }
      }
    } catch (err) {
      res = err;
    }
    renderData(null, res);
  },
  updateCustomFieldValues: async function (args) {
    var res;
    const participantsAndRegistrants = args
    try {
      const email = participantsAndRegistrants.event === "webinar.participant_joined" ? participantsAndRegistrants.payload.object.participant.email : participantsAndRegistrants.payload.object.registrant.email
      const webinarName = participantsAndRegistrants.event === "webinar.participant_joined" ? participantsAndRegistrants.payload.topic : participantsAndRegistrants.payload.object.topic
      const webinarURL = participantsAndRegistrants.event === "webinar.participant_joined" ? participantsAndRegistrants.payload.participant : participantsAndRegistrants.payload.object.registrant.join_url
      const join_time = participantsAndRegistrants.event === "webinar.participant_joined" ? participantsAndRegistrants.payload.object.participant.join_time : ""
      const response = await $request.invokeTemplate("contact_check", {
        context: { email: email }
      });

      // if (response.status !== 200) {
      //   console.error(`Error checking contact for ${email}: ${response.message}`);
      // }

      const contactData = JSON.parse(response.response);
      // console.log('Contact data:', contactData);

      if (contactData && contactData.length > 0) {
        const contactId = contactData[0].id;
        const contactDetails = await $request.invokeTemplate("view_contact", {
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
            "cf_total_number_of_zoom_webinar_registrations": join_time === "" ? totalRegistrations + 1 : totalRegistrations,
            "cf_total_number_of_zoom_webinars_attended": join_time !== "" ? totalAttended + 1 : totalAttended
          };

          const body = {
            contact: {
              custom_field: fieldsToUpdate
            }
          };

          const updateResponse = await $request.invokeTemplate("update_contact", {
            context: { id: contactId },
            body: JSON.stringify(body)
          });

          // if (updateResponse.status === 200) {
          //   console.log(`Successfully updated custom fields for contact ID: ${contactId}`, updateResponse);
          // } else {
          //   console.error(`Failed to update custom fields for contact ID: ${contactId}`);
          // }
          res = updateResponse;
        }
      } else {
        const addResponse = await addContactInFreshworks(participantsAndRegistrants);
        res = addResponse;
      }


    }
    catch (err) {
      res = err;
    }

    renderData(null, res);
  },
  addContactInFreshworks: async function (args) {
    const { name } = args;
    const [first_name, last_name] = name.split(" ");

    const body = {
      contact: {
        first_name: first_name || '',
        last_name: last_name || '',
        mobile_number: args.mobile_number || '',
        email: args.user_email || ''
      }
    };

    try {
       await client.request.invokeTemplate("create_contact", {
        body: JSON.stringify(body)
      });

      // if (response.status !== 200) {
      //   console.error(`Error creating contact for ${args.user_email}: ${response.message}`);
      // } else {
      //   console.log(`Successfully created contact for ${args.user_email}`);
      // }
    } catch (error) {
      console.error('Error in addContact:', error);
    }
  },
};
