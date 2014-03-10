fbstats
=======

facebook messaging statistics.
(Anonymized) sample output:
![sample](http://i.imgur.com/QuUJ3cc.png)

Usage
-----
You can use the version hosted at http://tehdog.github.io/fbstats/
As the API from facebook is still in beta, you will need to be facebook developer and create an "app" for this to work.

### Detailed App creation instructions

1. Go to https://developers.facebook.com/ and become a developer
2. Create a new app  
  ![create app](http://i.imgur.com/KTHXIsE.png)
3. Settings -> Add Platform -> Website. Site URL: http://github.io/
4. App Domains: tehdog.github.io
5. It should look like this:  
  ![scrernshert](http://i.imgur.com/UESItDP.png)
6. Go to http://tehdog.github.io/fbstats/ and put in your app id. Voilà!

Code
------
As I didn't plan this to be public, the code is really ugly and probably hard to understand, if you have questions just ask. But it's valid HTML5, yay!

The already downloaded message timestamps (Statistics.threads) will be stored locally, so they are cached when the page is refreshed.

### Todo
I'm not implying I will actually do these, but well 
* Restructure code. It's a mess, you can't even find the entry point.
* Support time range selection and zooming [like this](http://www.pureexample.com/jquery-flot/zooming-chart.html)
* Rewrite "Other" calculation
* Support import of messages.html from facebook data download
* Support downloading messages themselves for viewing excerpts and extended analysis
* ...
