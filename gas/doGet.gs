function doGet(e) {
  Logger.log('doGet start');
  var callback = e.parameter.callback;
  var result = getSheetData();
  if (callback) {
    var output = ContentService.createTextOutput();
    var responseText = callback + '(' + JSON.stringify(result) + ');';
    //Mime Typeをapplication/javascriptに設定
    output.setMimeType(ContentService.MimeType.JAVASCRIPT);
    output.setContent(responseText);
    return output;
  } else {
    var template = HtmlService.createTemplateFromFile('index');
    output = template.evaluate();
    output.setSandboxMode(HtmlService.SandboxMode.IFRAME);
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return output;
  }
}

function getSheetData() {
  var LIMIT = 100;
  var rssSheetName = "rss";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rssSheetName);
  var values = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var results = new Array();
  for (var i = 0; i < values.length; i++) {
    if(i + 1 > LIMIT) {
       break;
    }
    if (values[i][0] == "" || values[i][1] == "" || values[i][2] == "") {
       continue;
    }
    var feedItem = {
      title: values[i][0],
      link: values[i][1],
      time: values[i][2],
      isNew: values[i][3],
    };
    results.push(feedItem);
  }
  return results;
}
