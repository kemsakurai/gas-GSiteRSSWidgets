function onOpen() {
  const menu = [
    { name: 'Init', functionName: 'init' },
    { name: 'Input RSS URL', functionName: 'inputRSSURL' },
    { name: 'Fetch', functionName: 'fetch' }
  ];
  SpreadsheetApp.getActiveSpreadsheet().addMenu('gas-GSiteRSSWidgets', menu);
}

function init() {
    var rssSheetName = "rss"
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rssSheetName);
    if (!sheet) {
        sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet();
        sheet.setName(rssSheetName);
        var range = sheet.getRange('A1:D1');
        range.setBackground('yellow');
        var headers = new Array();
        headers.push('Title');
        headers.push('URL');
        headers.push('Date');
        headers.push('isNew');
        range.setValues([headers]);
    }
};

function inputRSSURL() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt('RSS の URL を入力してください。');
  var url = response.getResponseText();
  if (url == '' || response.getSelectedButton() == ui.Button.CLOSE) {
    return;
  }
  PropertiesService.getScriptProperties().setProperty("RSS_URL", url);
  ui.alert('入力した値を URL として設定しました。');
};

function fetch() {
  var url = PropertiesService.getScriptProperties().getProperty("RSS_URL");
  var parser = new FeedParser(url);
  var result = parser.parseFeed();
  var rssSheetName = "rss"
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rssSheetName);
  var values = new Array();
  for (var i = 0; i < result.length; i++) {
  　 var elems = new Array();
     elems.push(result[i].title);
     elems.push(result[i].link);
     elems.push(result[i].time);
     elems.push(result[i].time > Utils.getYesterday());
     values.push(elems);
  }
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
}
var FeedParser = /** @class */ (function () {
    /**
     * constructor
     * @param feedUrl
     */
    function FeedParser(feedUrl) {
        this.feedUrl = feedUrl;
       Utils.checkNotEmpty(this.feedUrl, 'feedUrl が 未設定です。feedUrl を設定してください。');
    }
    /**
     * parseFeed
     */
    FeedParser.prototype.parseFeed = function () {
        try {
            var document_1 = Utils.fetchAsXmlDocument(this.feedUrl);
            var feedType = this.determineFeedType(document_1);
            if (feedType == 'atom') {
                return this.parseAtom(document_1);
            }
            else if (feedType == 'rss1') {
                return this.parseRSS10(document_1);
            }
            else if (feedType == 'rss2') {
                return this.parseRSS20(document_1);
            }
            else {
                console.warn('Illegal feed format [URL]:%s', this.feedUrl);
                return new Array();
            }
        }
        catch (e) {
            console.warn(e);
            return new Array();
        }
    };
    FeedParser.prototype.parseRSS10 = function (document) {
        var root = document.getRootElement();
        var rss = XmlService.getNamespace('http://purl.org/rss/1.0/');
        var dc = XmlService.getNamespace('dc', 'http://purl.org/dc/elements/1.1/');
        var items = root.getChildren('item', rss);
        var feedItems = new Array();
        for (var i in items) {
            var link = items[i].getChild('link', rss).getText();
            link = Utils.decodeURIComponentSafety(link);
            var title = items[i].getChild('title', rss);
            var description = items[i].getChild('description', rss);
            var item = {
                title: Utils.getTextOrBlank(title),
                link: link,
                summary: Utils.getTextOrBlank(description),
                time: new Date(items[i].getChild('date', dc).getText())
            };
            feedItems.push(item);
        }
        return feedItems;
    };
    FeedParser.prototype.parseRSS20 = function (document) {
        var root = document.getRootElement();
        var items = root.getChild('channel').getChildren('item');
        var feedItems = new Array();
        var parentPubDate = root.getChild('channel').getChild('pubDate');
        for (var i in items) {
            var item = items[i];
            var link = item.getChild('link').getText();
            link = Utils.decodeURIComponentSafety(link);
            var description = item.getChild('description');
            var title = item.getChild('title');
            var feedItem = {
                title: Utils.getTextOrBlank(title),
                link: link,
                summary: Utils.getTextOrBlank(description),
                time: new Date(this.getPubdate(item, parentPubDate).getText())
            };
            feedItems.push(feedItem);
        }
        return feedItems;
    };
    /**
     * getPubdate
     * @param item
     * @param parentPubDate
     */
    FeedParser.prototype.getPubdate = function (item, parentPubDate) {
        if (item.getChild('pubDate') != null) {
            return item.getChild('pubDate');
        }
        var dc = XmlService.getNamespace('dc', 'http://purl.org/dc/elements/1.1/');
        if (item.getChild('date', dc) != null) {
            return item.getChild('date', dc);
        }
        return parentPubDate;
    };
    FeedParser.prototype.parseAtom = function (document) {
        var atomNS = XmlService.getNamespace('http://www.w3.org/2005/Atom');
        var entry = document.getRootElement().getChildren('entry', atomNS);
        var items = new Array();
        for (var i in entry) {
            var link = entry[i]
                .getChild('link', atomNS)
                .getAttribute('href')
                .getValue();
            if (link.match(/&url=(.*)&ct=ga/)) {
                link = Utils.decodeURIComponentSafety(link.match(/&url=(.*)&ct=ga/)[1]);
            }
            else {
                link = Utils.decodeURIComponentSafety(link);
            }
            var updated = entry[i].getChild('updated', atomNS).getText();
            var time = Utils.toDate(updated);
            if (time.toString() === 'Invalid Date') {
                var pubDate = entry[i].getChild('pubDate', atomNS).getText();
                time = Utils.toDate(pubDate);
            }
            var title = entry[i].getChild('title', atomNS);
            var content = entry[i].getChild('content', atomNS);
            var item = {
                title: Utils.getTextOrBlank(title),
                link: link,
                summary: Utils.getTextOrBlank(content).replace(/&nbsp;|&raquo;|and more/g, ' '),
                time: time
            };
            items.push(item);
        }
        return items;
    };
    /**
     * determineFeedType
     * @param document
     */
    FeedParser.prototype.determineFeedType = function (document) {
        var atomNS = XmlService.getNamespace('http://www.w3.org/2005/Atom');
        var entry = document.getRootElement().getChildren('entry', atomNS);
        if (entry && entry.length > 0) {
            return 'atom';
        }
        var rssNS = XmlService.getNamespace('http://purl.org/rss/1.0/');
        var item = document.getRootElement().getChildren('item', rssNS);
        if (item && item.length > 0) {
            return 'rss1';
        }
        var channel = document.getRootElement().getChild('channel');
        if (channel) {
            var item_1 = channel.getChildren('item');
            if (item_1 && item_1.length > 0) {
                return 'rss2';
            }
        }
        return 'other';
    };
    return FeedParser;
}());

var UTF8_URI = new RegExp('%[0-7][0-9A-F]|' +
    '%C[2-9A-F]%[89AB][0-9A-F]|%D[0-9A-F]%[89AB][0-9A-F]|' +
    '%E[0-F](?:%[89AB][0-9A-F]){2}|' +
    '%F[0-7](?:%[89AB][0-9A-F]){3}|' +
    '%F[89AB](?:%[89AB][0-9A-F]){4}|' +
    '%F[CD](?:%[89AB][0-9A-F]){5}', 'ig');
var Utils = /** @class */ (function () {
    function Utils() {
    }
    Utils.fetchAsJson = function (url, requestOptions) {
        var response = UrlFetchApp.fetch(url, requestOptions);
        return JSON.parse(response.getContentText());
    };
    Utils.fetchAsXmlDocument = function (url) {
        var response = UrlFetchApp.fetch(url);
        var result;
        try {
            result = XmlService.parse(response.getContentText());
        }
        catch (e) {
            var spStr = [
                11,
                8203 // ゼロ幅スペース
            ];
            var txtBefore = response.getContentText();
            var txtAfter = '';
            for (var i = 0; i < txtBefore.length; i++) {
                var chr = txtBefore.charCodeAt(i);
                if (spStr.indexOf(chr) == -1) {
                    txtAfter += String.fromCharCode(chr);
                }
            }
            result = XmlService.parse(txtAfter);
        }
        return result;
    };
    /**
     * setNumberOfDescription
     * @param number
     */
    Utils.setNumberOfDescription = function (number) {
        PropertiesService.getScriptProperties().setProperty('NUMBER_OF_DESCRIPTION', number);
    };
    /**
     * truncate
     * @param value
     * @param length
     */
    Utils.truncate = function (value, length) {
        if (value.length <= length) {
            return value;
        }
        return value.substring(0, length) + '...';
    };
    /**
     * getNumberOfDescription
     */
    Utils.getNumberOfDescription = function () {
        var numberOfDescription = parseInt(PropertiesService.getScriptProperties().getProperty('NUMBER_OF_DESCRIPTION'));
        if (isNaN(numberOfDescription)) {
            numberOfDescription = -1;
        }
        return numberOfDescription;
    };
    /**
     * setChatworkToken
     * @param token
     */
    Utils.setChatworkToken = function (token) {
        PropertiesService.getScriptProperties().setProperty('CHATWORK_TOKEN', token);
    };
    /**
     * getChatworkToken
     */
    Utils.getChatworkToken = function () {
        return PropertiesService.getScriptProperties().getProperty('CHATWORK_TOKEN');
    };
    /**
     * getYesterday
     */
    Utils.getYesterday = function () {
        var now = new Date();
        var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        return yesterday;
    };
    /**
     * getToday
     */
    Utils.getToday = function () {
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return today;
    };
    /**
     * checkNotEmpty
     */
    Utils.checkNotEmpty = function (value, message) {
        if (typeof value === 'undefined' || value == '') {
            throw new Error(message);
        }
    };
    /**
     * getRSSSheetName
     */
    Utils.getRSSSheetName = function () {
        return 'RSS';
    };
    /**
     * getRoomSheetName
     */
    Utils.getRoomSheetName = function () {
        return 'Room';
    };
    /**
     * decodeURIComponentSafety
     * @param link
     */
    Utils.decodeURIComponentSafety = function (link) {
        var result = link.replace(UTF8_URI, function (whole) {
            return decodeURIComponent(whole);
        });
        return result;
    };
    /**
     * getTextOrBlank
     */
    Utils.getTextOrBlank = function (element) {
        var result = '';
        if (element) {
            // htmlタグを除去する
            result = element.getText().replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, '');
        }
        return result;
    };
    /**
     * toDate
     * @param updated
     */
    Utils.toDate = function (updated) {
        var time = new Date(updated);
        if (time.toString() === 'Invalid Date') {
            time = new Date(updated
                .replace('T', ' ')
                .replace('Z', ' GMT')
                .replace(/-/g, '/'));
        }
        return time;
    };
    return Utils;
}());