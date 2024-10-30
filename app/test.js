console.log("Starting testEndpoint");

async function testEndpoint() {
  const url = "https://chats.mytrip.ai/amalia-assistant/chat";

  const headers = {
    "Content-Type": "application/json"
  };

  const data = {
    message: "Hello",
    client_id: "testing_1111111",
    flag: 1
  };

  try {
    console.log("Making POST request...");
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.log("Response status not OK");
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Response received");
    const responseData = await response.json();
    console.log("Response from the server:", responseData);
  } catch (error) {
    console.error("Error making request:", error);
  }
}

testEndpoint();
