(function (root) {
  'use strict';
  const dateOf = value => new Date(value + 'T12:00:00Z');
  const iso = date => date.toISOString().slice(0, 10);
  const plantCalendar = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/Denver', year:'numeric', month:'2-digit', day:'2-digit'
  });
  function plantDate(instant=new Date()) {
    const parts=Object.fromEntries(plantCalendar.formatToParts(instant).map(part=>[part.type,part.value]));
    return [parts.year,parts.month,parts.day].join('-');
  }
  function days(value, count) {
    const date = dateOf(value);
    date.setUTCDate(date.getUTCDate() + count);
    return iso(date);
  }
  function months(value, count, anchor) {
    const date = dateOf(value);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count + 1, 0);
    date.setUTCDate(Math.min(date.getUTCDate(), anchor));
    return iso(date);
  }
  function advance(rule, from) {
    if (rule.unit === 'months' || rule.unit === 'years') {
      const target = months(from, rule.interval * (rule.unit === 'years' ? 12 : 1), Number(rule.start.slice(-2)));
      if(rule.pattern==='first-weekday'){
        const first=target.slice(0,8)+'01';
        const weekday=dateOf(first).getUTCDay();
        return days(first,weekday===0?1:weekday===6?2:0);
      }
      if(rule.pattern==='ordinal'){
        const start=dateOf(rule.start), first=target.slice(0,8)+'01';
        const offset=(start.getUTCDay()-dateOf(first).getUTCDay()+7)%7;
        return days(first,offset+7*Math.floor((start.getUTCDate()-1)/7));
      }
      return target;
    }
    return days(from, rule.interval * (rule.unit === 'weeks' ? 7 : 1));
  }
  function occurrences(rule, through) {
    const dates = [];
    if (rule.paused) return dates;
    for (let date = rule.next; date && date <= through; date = advance(rule, date)) {
      const month = Number(date.slice(5, 7));
      if (!rule.months.length || rule.months.includes(month)) dates.push(date);
      if (rule.mode === 'completion') break;
    }
    return dates;
  }
  const api = {plantDate, days, months, advance, occurrences};
  if (typeof module === 'object') module.exports = api;
  else root.WorkSchedule = api;
})(globalThis);
