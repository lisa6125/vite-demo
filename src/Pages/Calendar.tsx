import { ArrowBackIos, ArrowForwardIos } from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import dayjs, { Dayjs } from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { saveAs } from "file-saver";
import { convert } from "ical2json";
import { createEvents } from "ics";
import * as R from "ramda";
import { useState } from "react";
dayjs.extend(isBetween);

const WEEK_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const DAY_LABELS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const INIT_EXCEPT_DAYS = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
};

const CalendarPage = () => {
  const now = dayjs();
  const [baseDate, setBaseDate] = useState(now.startOf("month"));
  const [year, setYear] = useState(now.year());
  const [open, setOpen] = useState(false);
  const [countryHolidays, setCountryHolidays] = useState<any[]>([]); // 國定假日
  const [weeklyHolidays, setWeeklyHolidays] = useState<number[]>([]); // 例假日
  const [exceptDays, setExceptDays] =
    useState<Record<number, string[]>>(INIT_EXCEPT_DAYS); // 例假日的例外日期

  const handleYearChange = (e) => {
    const newYear = e.target.value;
    setYear(newYear);
    setBaseDate(baseDate.year(newYear));
  };

  const handleMonthChange = (direction: "prev" | "next") => {
    const newDate = baseDate.add(direction === "prev" ? -1 : 1, "month");
    setBaseDate(newDate);
    setYear(newDate.year());
  };

  const toggleHoliday = (index: number) => {
    setWeeklyHolidays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index]
    );
    setExceptDays((prev) => ({ ...prev, [index]: [] }));
  };

  const getDateInfo = (date: Dayjs) => {
    let isCountryHoliday = false,
      countrySummary,
      isWeeklyHoliday =
        weeklyHolidays.includes(date.day()) &&
        !exceptDays[date.day()].includes(date.format("YYYYMMDD"));

    if (countryHolidays.length !== 0) {
      countryHolidays.forEach(({ start, summary: innerS, end }) => {
        if (date.isBetween(dayjs(start), dayjs(end), null, "[)")) {
          isCountryHoliday = true;
          countrySummary = innerS;
        }
      });
    }
    return {
      isCountryHoliday,
      isHighlighted: isCountryHoliday || isWeeklyHoliday,
      summary: countrySummary || (isWeeklyHoliday && "非工作日") || "",
    };
  };

  const generateMonthDays = (year: number, month: number) => {
    const days: (Dayjs | null)[] = [];
    const firstDay = dayjs(`${year}-${month + 1}-01`);
    const startOfWeek = firstDay.startOf("week");
    const endOfMonth = firstDay.endOf("month");
    const endOfWeek = endOfMonth.endOf("week");

    let date = startOfWeek;
    while (date.isBefore(endOfWeek) || date.isSame(endOfWeek, "day")) {
      days.push(date);
      date = date.add(1, "day");
    }

    return days;
  };

  // 匯出至 .ics 檔案的功能
  // TODO: 補上國定假日event
  const exportToICS = () => {
    const events = [];

    // 針對每一個 weeklyHoliday（例假日星期幾）
    weeklyHolidays.forEach((dayOfWeek) => {
      let firstDate = dayjs(`2020-01-01`).day(dayOfWeek);

      // 如果1月1日那週還沒到指定的 weekday，要往後推一週
      if (firstDate.isBefore(dayjs(`${year}-01-01`))) {
        firstDate = firstDate.add(7, "day");
      }

      events.push({
        start: [firstDate.year(), firstDate.month() + 1, firstDate.date()],
        duration: { days: 1 },
        title: `非工作日 - 每週${WEEK_LABELS[dayOfWeek]}`,
        description: "這是設定的例假日，請留意休假安排。",
        location: "",
        status: "CONFIRMED",
        exclusionDates: exceptDays[dayOfWeek],
        recurrenceRule: `FREQ=WEEKLY;BYDAY=${DAY_LABELS[dayOfWeek]};UNTIL=${year}1231T235959Z`, // 重複到當年12/31
      });
    });

    // 國定假日
    countryHolidays.forEach(({ start, summary, end }) => {
      const startDate = dayjs(start),
        endDate = dayjs(end);

      events.push({
        start: [startDate.year(), startDate.month() + 1, startDate.date()],
        end: [endDate.year(), endDate.month() + 1, endDate.date()],
        title: summary,
        location: "",
        description: "",
      });
    });
    console.log("events", events);

    createEvents(events, (error, value) => {
      if (error) {
        console.error(error);
        return;
      }
      const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
      saveAs(blob, `calendar_${year}.ics`);
    });
  };

  // 設定取消非工作日設定
  const cancelUnWorkDay = (date: Dayjs, isCountryHoliday?: boolean) => {
    const day = date.day();
    if (isCountryHoliday) {
      setCountryHolidays(
        R.filter(({ start, end }) => {
          // 判斷目標日期是否在事件日期範圍內
          return date.format("YYYYMMDD") !== start;
        })
      );
    }
    setExceptDays((prev) => ({
      ...prev,
      [day]: [...prev[day], date.format("YYYYMMDD")],
    }));
  };

  // 匯入 .ics 檔案的功能
  const importFromICS = (event) => {
    const file = event.target.files[0];

    if (!file) {
      console.warn("未選擇檔案");
      return;
    }

    if (file) {
      // 先將舊的資料清空
      setWeeklyHolidays([]);
      setCountryHolidays([]);
      setExceptDays(INIT_EXCEPT_DAYS);
      const reader = new FileReader();
      reader.onload = () => {
        const icsData = reader.result as string;
        ICS_parser(icsData);
      };
      reader.readAsText(file);
    }
  };

  const ICS_parser = (icsData) => {
    // 開始轉資料進 state
    const data = convert(icsData);
    const event = data["VCALENDAR"][0]["VEVENT"] as any as Array<
      Record<string, string>
    >;
    console.log("data,event", data, event);
    const chArr: { start: string; summary: string; end: string }[] = []; //國定假日

    event.map((e) => {
      const isFreq = Boolean(e?.["RRULE"]?.includes("FREQ=WEEKLY"));
      if (isFreq) {
        // week 要處理的
        // 設定常態非工作日
        const byDay = e["RRULE"].split(";")[1].split("=")[1];
        const day = DAY_LABELS.indexOf(byDay);
        setWeeklyHolidays((prev) => [...prev, day]);

        // 設定常態非工作日例外
        const exDates = R.uniqBy(String, e["EXDATE"].split(","));
        setExceptDays((prev) => ({
          ...prev,
          [day]: [...prev[day], ...exDates],
        }));
      } else {
        // country 要處理的
        // 計算有 start 與 end date 的國定假日 countryHolidays
        // 如果是多天連假要拆分
        const startDate = dayjs(e["DTSTART;VALUE=DATE"]),
          endDate = dayjs(e["DTEND;VALUE=DATE"]);
        const daysDiff = endDate.diff(startDate, "days");
        if (daysDiff > 1) {
          for (let i = 0; i < daysDiff; i++) {
            chArr.push({
              start: startDate.add(i, "day").format("YYYYMMDD"),
              summary: e["SUMMARY"],
              end: startDate.add(i + 1, "day").format("YYYYMMDD"),
            });
          }
        } else {
          chArr.push({
            start: e["DTSTART;VALUE=DATE"],
            summary: e["SUMMARY"],
            end: e["DTEND;VALUE=DATE"],
          });
        }
      }
    });
    setCountryHolidays(chArr);
  };

  console.log("countryHolidays", countryHolidays);
  console.log("weeklyHolidays", weeklyHolidays);
  console.log("exceptDays", exceptDays);

  return (
    <Box p={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">行事曆</Typography>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          例假日設定
        </Button>
      </Box>

      <Box display="flex" alignItems="center" gap={2} mt={2} mb={2}>
        <Select size="small" value={year} onChange={handleYearChange}>
          {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText sx={{ mt: 0, ml: 1, color: "text.secondary" }}>
          * 非工作日以紅圈標示
        </FormHelperText>
      </Box>

      <Box position="relative" width={600}>
        <Box sx={{ position: "absolute", left: -30, top: 100 }}>
          <IconButton onClick={() => handleMonthChange("prev")}>
            <ArrowBackIos fontSize="small" />
          </IconButton>
        </Box>

        <Box display="flex" gap={4} justifyContent="center">
          {[0, 1].map((offset) => {
            const monthDate = baseDate.add(offset, "month");
            const days = generateMonthDays(monthDate.year(), monthDate.month());

            return (
              <Box key={offset} width={300}>
                <Typography variant="subtitle1" align="center" mb={1}>
                  {monthDate.year()}年 {monthDate.month() + 1}月
                </Typography>

                {/* 星期列 */}
                <Box display="flex">
                  {WEEK_LABELS.map((w) => (
                    <Box
                      key={w}
                      width={40}
                      height={40}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Typography fontSize="14px" fontWeight="bold">
                        {w}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* 日期列 */}
                <Box display="flex" flexWrap="wrap">
                  {days.map((date, idx) => {
                    const { isHighlighted, summary, isCountryHoliday } =
                      getDateInfo(date);
                    const isInMonth = date.month() == monthDate.month();

                    return (
                      <Box
                        key={idx}
                        width={40}
                        height={40}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        {date ? (
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              backgroundColor:
                                isHighlighted && isInMonth
                                  ? "rgba(255, 0, 0, 0.2)"
                                  : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: !isInMonth
                                ? "text.disabled"
                                : isHighlighted
                                ? "error.main"
                                : "text.primary",
                              fontSize: "14px",
                            }}
                            onClick={() => {
                              isHighlighted &&
                                cancelUnWorkDay(date, isCountryHoliday);
                            }}
                          >
                            {date.date()}
                            <Typography sx={{ fontSize: 10 }}>
                              {isInMonth && summary}
                            </Typography>
                          </Box>
                        ) : null}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ position: "absolute", right: -30, top: 100 }}>
          <IconButton onClick={() => handleMonthChange("next")}>
            <ArrowForwardIos fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* 設定例假日的 Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>例假日設定</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>選擇例假日</Typography>
          <Box display="flex" gap={2}>
            {WEEK_LABELS.map((label, index) => (
              <FormControlLabel
                key={label}
                control={
                  <Checkbox
                    checked={weeklyHolidays.includes(index)}
                    onChange={() => toggleHoliday(index)}
                  />
                }
                label={label}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            確定
          </Button>
        </DialogActions>
      </Dialog>

      {/* 匯入 .ics 檔案 */}
      <input
        type="file"
        onChange={importFromICS}
        onClick={(e) => {
          // 每次點擊時重置檔案輸入
          e.target.value = "";
        }}
        style={{ display: "none" }}
        id="ics-file-input"
      />
      <Box mt={2}>
        <label htmlFor="ics-file-input">
          <Button variant="contained" component="span">
            匯入 .ics
          </Button>
        </label>
      </Box>

      {/* 匯出 .ics 按鈕 */}
      <Box mt={2}>
        <Button variant="contained" onClick={exportToICS}>
          匯出 .ics
        </Button>
      </Box>
    </Box>
  );
};

export default CalendarPage;
