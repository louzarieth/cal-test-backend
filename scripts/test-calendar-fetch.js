const https = require('https');

// Google Calendar API configuration
const GOOGLE_API_KEY = 'AIzaSyCEpcJdO5FPDoNT49qaaqVXq9INsphQSQE';
const CALENDAR_ID = 'df80381b3317c2ce323ec7376a93dd57fbaa8e733452e576b56ace1656198c31@group.calendar.google.com';

// Get today's date
const today = new Date();
const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?` +
  `key=${GOOGLE_API_KEY}&` +
  `timeMin=${timeMin}&` +
  `timeMax=${timeMax}&` +
  `singleEvents=true&` +
  `orderBy=startTime`;

console.log('Fetching events from Google Calendar...');
console.log('URL:', url);

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\nGoogle Calendar API Response:');
      console.log('Status Code:', res.statusCode);
      console.log('Number of events:', response.items ? response.items.length : 0);
      
      if (response.items && response.items.length > 0) {
        console.log('\nEvents for today:');
        response.items.forEach((event, index) => {
          console.log(`\nEvent #${index + 1}:`);
          console.log('Title:', event.summary);
          console.log('Start:', event.start.dateTime || event.start.date);
          console.log('End:', event.end.dateTime || event.end.date);
          console.log('Description:', event.description || 'N/A');
        });
      } else {
        console.log('\nNo events found for today.');
        console.log('Full response:', JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
  
}).on('error', (error) => {
  console.error('Error fetching events:', error);
});
