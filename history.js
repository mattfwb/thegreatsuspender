/*global chrome, gsUtils, render, createWindowHtml, createTabHtml, getSessionById */

(function () {

    'use strict';

    var tabs = {},
        windows = {};

    function getFormattedDate(date, includeTime) {
        var d = new Date(date),
            cur_date = ('0' + d.getDate()).slice(-2),
            cur_month = ('0' + (d.getMonth() + 1)).slice(-2),
            cur_year = d.getFullYear(),
            cur_time = d.toTimeString().match(/^([0-9]{2}:[0-9]{2})/)[0];

        if (includeTime) {
            return cur_time + ' ' + cur_date + '-' + cur_month + '-' + cur_year;
        }
        return cur_date + '-' + cur_month + '-' + cur_year;
    }

    function compareDate(a, b) {
        if (a.date > b.date) {
            return -1;
        }
        if (a.date < b.date) {
            return 1;
        }
        return 0;
    }

    function reloadTabs(element, suspendMode) {

        return function () {

            chrome.runtime.getBackgroundPage(function (backgroundPage) {

                var tgs = backgroundPage.tgs,
                    windowId = element.getAttribute('data-windowId'),
                    sessionId = element.getAttribute('data-sessionId'),
                    session = gsUtils.getSessionById(sessionId),
                    window = gsUtils.getWindowFromSession(windowId, session),
                    curTab,
                    curUrl,
                    i;

                chrome.windows.create(function (newWindow) {

                    for (i = 0; i < window.tabs.length; i += 1) {

                        curTab = window.tabs[i];
                        curUrl = curTab.url;
                        if (suspendMode && curUrl.indexOf('suspended.html') < 0 && !tgs.isSpecialTab(curTab)) {
                            curUrl = gsUtils.generateSuspendedUrl(curUrl);

                        } else if (!suspendMode && curUrl.indexOf('suspended.html') > 0) {
                            curUrl = gsUtils.getHashVariable('url', curTab.url.split('suspended.html')[1]);
                        }
                        chrome.tabs.create({windowId: newWindow.id, url: curUrl, pinned: curTab.pinned, active: false});
                    }

                    chrome.tabs.query({windowId: newWindow.id, index: 0}, function (tabs) {
                        chrome.tabs.remove(tabs[0].id);
                    });
                });
            });
        };
    }

    function removeTab(element) {

        return function () {

            var tabId = element.getAttribute('data-tabId'),
                windowId = element.getAttribute('data-windowId'),
                sessionId = element.getAttribute('data-sessionId');

            gsUtils.removeTabFromSessionHistory(sessionId, windowId, tabId);
            render();
        };
    }

    function toggleSession(element) {

        return function () {
            if (element.childElementCount > 0) {
                element.innerHTML = '';
                return;
            }

            var sessionId = element.getAttribute('data-sessionId'),
                session = getSessionById(sessionId),
                j,
                k,
                windowProperties,
                tabProperties;

            for (j = 0; j < session.windows.length; j += 1) {
                windowProperties = session.windows[j];
                windowProperties.sessionId = session.id;
                element.appendChild(createWindowHtml(windowProperties, j));

                for (k = 0; k < session.windows[j].tabs.length; k += 1) {
                    tabProperties = session.windows[j].tabs[k];
                    tabProperties.windowId = session.windows[j].id;
                    tabProperties.sessionId = session.id;
                    element.appendChild(createTabHtml(tabProperties));
                }
            }
        };
    }

    function hideModal() {
        document.getElementById('sessionNameModal').style.display = 'none';
        document.getElementsByClassName('mainContent')[0].className = 'mainContent';
    }

    function saveSession(sessionId) {

        var session = getSessionById(sessionId);

        document.getElementsByClassName('mainContent')[0].className += ' blocked';
        document.getElementById('sessionNameModal').style.display = 'block';
        document.getElementById('sessionNameText').focus();

        document.getElementById('sessionNameCancel').onclick = hideModal;
        document.getElementById('sessionNameSubmit').onclick = function () {

            var text = document.getElementById('sessionNameText').value;
            if (text) {
                gsUtils.saveSession(text, session);
                render();
            }
        };
    }

    function getSessionById(sessionId) {

        var gsHistory = gsUtils.fetchGsSessionHistory(),
            gsSavedHistory = gsUtils.fetchGsSavedSessions(),
            i;

        for (i = 0; i < gsHistory.length; i += 1) {
            if (gsHistory[i].id === sessionId) {
                return gsHistory[i];
            }
        }
        for (i = 0; i < gsSavedHistory.length; i += 1) {
            if (gsSavedHistory[i].id === sessionId) {
                return gsSavedHistory[i];
            }
        }
        return false;
    }

    function createSessionHtml(session) {

        var savedSession = session.name ? true : false,
            sessionContainer,
            sessionTitle,
            sessionSave,
            sessionDiv,
            j,
            k,
            tabCount = 0;

        for (j = 0; j < session.windows.length; j += 1) {
            for (k = 0; k < session.windows[j].tabs.length; k += 1) {
                tabCount += 1;
            }
        }

        sessionTitle = document.createElement('span');
        sessionTitle.className = 'sessionLink';

        if (savedSession) {
            sessionTitle.innerHTML = session.name + ' (' + j + ' window' + (j > 1 ? 's' : '') + ', ' + tabCount + ' tab' + (tabCount > 1 ? 's' : '') + ')';
        } else {
            sessionTitle.innerHTML = j + ' window' + (j > 1 ? 's' : '') + ', ' + tabCount + ' tab' + (tabCount > 1 ? 's' : '') + ': ' + gsUtils.getHumanDate(session.date);
            sessionSave = document.createElement('a');
            sessionSave.className = 'groupLink';
            sessionSave.setAttribute('href', '#');
            sessionSave.innerHTML = 'save session';
            sessionSave.onclick = function () { saveSession(session.id); };
        }
        sessionDiv = document.createElement('div');
        sessionDiv.setAttribute('data-sessionId', session.id);
        sessionTitle.onclick = toggleSession(sessionDiv);
        sessionContainer = document.createElement('div');
        sessionContainer.appendChild(sessionTitle);
        if (!savedSession) { sessionContainer.appendChild(sessionSave); }
        sessionContainer.appendChild(sessionDiv);

        return sessionContainer;
    }

    function createWindowHtml(window, count) {

        var groupHeading,
            groupUnsuspendCurrent,
            groupUnsuspendNew;

        groupHeading = document.createElement('p');
        groupHeading.setAttribute('data-windowId', window.id);
        groupHeading.setAttribute('data-sessionId', window.sessionId);
        groupHeading.innerHTML = 'Window ' + (count + 1) + ':&nbsp;';// + ' (' + window.tabs.length + ' tab' + (window.tabs.length > 1 ? 's)' : ')') + '<br />';
        groupUnsuspendCurrent = document.createElement('a');
        groupUnsuspendCurrent.className = 'groupLink';
        groupUnsuspendCurrent.setAttribute('href', '#');
        groupUnsuspendCurrent.innerHTML = 'resuspend all tabs';
        groupUnsuspendCurrent.onclick = reloadTabs(groupHeading, true);
        groupHeading.appendChild(groupUnsuspendCurrent);
        groupUnsuspendNew = document.createElement('a');
        groupUnsuspendNew.className = 'groupLink';
        groupUnsuspendNew.setAttribute('href', '#');
        groupUnsuspendNew.innerHTML = 'reload all tabs';
        groupUnsuspendNew.onclick = reloadTabs(groupHeading, false);
        groupHeading.appendChild(groupUnsuspendNew);

        return groupHeading;
    }

    function createTabHtml(tabProperties) {

        var linksSpan = document.createElement('div'),
            listImg,
            listLink,
            listHover,
            favicon = false;

        favicon = favicon || tabProperties.favicon;
        favicon = favicon || tabProperties.favIconUrl;
        favicon = favicon || 'chrome://favicon/' + tabProperties.url;

        linksSpan.className = 'recoveryLink';
        if (tabProperties.sessionId) {
            linksSpan.setAttribute('data-tabId', tabProperties.id || tabProperties.url);
            linksSpan.setAttribute('data-windowId', tabProperties.windowId);
            linksSpan.setAttribute('data-sessionId', tabProperties.sessionId);
        } else {
            linksSpan.setAttribute('data-url', tabProperties.url);
        }
        listHover = document.createElement('img');
        listHover.setAttribute('src', chrome.extension.getURL('x.gif'));
        listHover.className = 'itemHover';
        listHover.onclick = removeTab(linksSpan);
        linksSpan.appendChild(listHover);
        listImg = document.createElement('img');
        listImg.setAttribute('src', favicon);
        listImg.setAttribute('height', '16px');
        listImg.setAttribute('width', '16px');
        linksSpan.appendChild(listImg);
        listLink = document.createElement('a');
        listLink.setAttribute('class', 'historyLink');
        listLink.setAttribute('href', tabProperties.url);
        listLink.setAttribute('target', '_blank');
        listLink.innerHTML = tabProperties.title;
        linksSpan.appendChild(listLink);
        linksSpan.appendChild(document.createElement('br'));

        return linksSpan;
    }


    function render() {

        var gsSessionHistory = gsUtils.fetchGsSessionHistory(),
            gsSavedSessions = gsUtils.fetchGsSavedSessions(),
            i,
            sessionsDiv = document.getElementById('recoveryLinks'),
            historyDiv = document.getElementById('historyLinks'),
            session,
            sessionEl;

        hideModal();
        sessionsDiv.innerHTML = '';

        for (i = 0; i < gsSessionHistory.length; i += 1) {

            session = gsSessionHistory[i];
            sessionEl = sessionsDiv.appendChild(createSessionHtml(session));
        }


        historyDiv.innerHTML = '';

        for (i = 0; i < gsSavedSessions.length; i += 1) {

            session = gsSavedSessions[i];
            sessionEl = historyDiv.appendChild(createSessionHtml(session));
        }

        /*var gsHistory = gsUtils.fetchGsHistory(),
            historyMap = {},
            tabProperties,
            key,
            groupKey,
            curGroupKey,
            historyDiv,
            groupHeading;

        historyDiv = document.getElementById('historyLinks');
        gsHistory.sort(compareDate);

        historyDiv.innerHTML = '';

        for (i = 0; i < gsHistory.length; i += 1) {
            tabProperties = gsHistory[i];
            groupKey = getFormattedDate(tabProperties.date, false);
            key = groupKey + tabProperties.url;

            if (!historyMap.hasOwnProperty(key)) {

                //print header for group
                if (groupKey !== curGroupKey) {
                    curGroupKey = groupKey;
                    groupHeading = document.createElement('h3');
                    groupHeading.innerHTML = gsUtils.getHumanDate(tabProperties.date);
                    historyDiv.appendChild(groupHeading);
                }
                historyMap[key] = true;
                historyDiv.appendChild(createTabHtml(tabProperties));
            }
        }*/
    }

    window.onload = function () {
        render();
    };

}());
