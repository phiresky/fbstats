fbstats
=======

facebook messaging statistics. See screenshots below for sample output. Also supports downloading your entire messaging history as [CSV](https://en.wikipedia.org/wiki/Comma-separated_values).

(Anonymized) sample output
-----
version 1, stacked, weekly, log scale:
![sample](http://i.imgur.com/QuUJ3cc.png)
version 2, in/out separate, weekly, linear scale:
![sample2](http://i.imgur.com/iM5TM7z.png)
version 2, two people
![sample2](http://i.imgur.com/yV80qMI.png)
Usage
-----
You can use the version hosted at http://phiresky.github.io/fbstats/
As the API from facebook is in beta, you will need to be facebook developer and create an "app" for this to work.

**As of [2014-04-30 facebook added](https://developers.facebook.com/blog/post/2014/04/30/the-new-facebook-login/) [new restrictions](https://developers.facebook.com/docs/apps/changelog) to their api. The parts I use are now deprecated, facebook might remove the endpoint in the future.**

**As of 2014-08-07 [(v2.1)](https://developers.facebook.com/blog/post/2014/08/07/Graph-API-v2.1/) facebook removed the ability to access the FQL message endpoint. Apps created after that date will not work. The new method of accessing the data is far too slow for this purpose. (see [issue 6](https://github.com/phiresky/fbstats/issues/6))**

### Detailed App creation instructions

1. Go to https://developers.facebook.com/ and become a developer
2. Create a new app  
  ![create app](http://i.imgur.com/KTHXIsE.png)
3. Settings -> Add Platform -> Website. Site URL: http://github.io/
4. App Domains: phiresky.github.io
5. It should look like this:  
  ![scrernshert](http://i.imgur.com/UESItDP.png)
6. Go to http://phiresky.github.io/fbstats/ and put in your app id. Voilà!

Code
------
As I didn't plan this to be public, the code is really ugly and probably hard to understand, if you have questions just ask. But it's valid HTML5, yay!

The already downloaded message timestamps (Statistics.threads) will be stored locally, so they are cached when the page is refreshed.

### Todo
I'm not implying I will actually do these, but well 
* ~~Restructure code. It's a mess, you can't even find the entry point.~~ It is now [TypeScript](http://typescriptlang.org) and in multiple files.
* Support time range selection and zooming [like this](http://www.pureexample.com/jquery-flot/zooming-chart.html)
* ~~Rewrite "Other" calculation~~ Should be better
* Support import of messages.html from facebook data download
* ~~Support downloading messages themselves for viewing excerpts and extended analysis~~ Works now, complete data is downloadable as CSV.
* ...
