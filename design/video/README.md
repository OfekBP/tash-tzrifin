# סרטון הדרכה: עוזר הת״ש

- `ozer-tash.mp4`: הסרטון הסופי (720x1280, כ-41 שניות).
- `src/video.html`: מקור הסרטון (אנימציות CSS). `src/render.mjs`: מצלם פריימים עם Chrome (puppeteer-core) ואז ffmpeg מחבר ל-mp4.
- `src/a/`: פונטים, לוגואים וצילומי מסך של הנוטבוק (s1-s7).
- זה חומר שיווק בלבד. הוא לא חלק מהאתר ולא נטען ממנו.

הרצה: `npm i puppeteer-core ffmpeg-static` בתיקייה נפרדת, `node render.mjs`, ואז ffmpeg:
`ffmpeg -framerate 20 -i frames/f%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 23 ozer-tash.mp4`
