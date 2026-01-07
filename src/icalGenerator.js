const { default: ical } = require('ical-generator');
const dayjs = require('dayjs');

class ICalGenerator {
  constructor() {
    const prefecture = process.env.DOYU_PREFECTURE || 'shimane';
    const domain = process.env.ICAL_DOMAIN || `${prefecture}-doyu.local`;
    
    this.calendar = ical({
      domain: domain,
      name: `${prefecture}県同友会スケジュール`,
      description: `${prefecture}県同友会のイベントスケジュール`,
      timezone: 'Asia/Tokyo'
    });
  }

  addEvent(eventData) {
    // 日付の検証と修正
    let startDate = this.validateAndFixDate(eventData.startDate);
    let endDate = eventData.endDate ? this.validateAndFixDate(eventData.endDate) : null;
    
    // デフォルト日付の設定
    if (!startDate) {
      console.warn(`Invalid start date for event "${eventData.title}", using current date`);
      startDate = new Date();
    }
    
    if (!endDate) {
      endDate = dayjs(startDate).add(1, 'hour').toDate();
    }


    const event = {
      uid: `doyu-${eventData.id}@${process.env.ICAL_DOMAIN || `${process.env.DOYU_PREFECTURE || 'shimane'}-doyu.local`}`,
      start: startDate,
      end: endDate,
      summary: eventData.title || 'No Title',
      description: eventData.description || '',
      location: eventData.location || '',
      url: eventData.url || '',
      created: new Date(),
      lastModified: new Date()
    };

    console.log(`Adding event: ${event.summary} on ${dayjs(startDate).format('YYYY-MM-DD HH:mm')}`);
    this.calendar.createEvent(event);
  }

  validateAndFixDate(dateInput) {
    if (!dateInput) return null;
    
    // 既にDateオブジェクトの場合
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      return dateInput;
    }
    
    // 文字列の場合
    if (typeof dateInput === 'string') {
      const parsed = dayjs(dateInput);
      if (parsed.isValid()) {
        return parsed.toDate();
      }
    }
    
    // dayjsオブジェクトの場合
    if (dateInput && typeof dateInput === 'object' && dateInput._isAMomentObject) {
      return dateInput.toDate();
    }
    
    return null;
  }

  addEvents(eventsData) {
    eventsData.forEach(event => this.addEvent(event));
  }

  generate() {
    return this.calendar.toString();
  }

  clear() {
    this.calendar.clear();
  }

  getEventCount() {
    return this.calendar.events().length;
  }
}

module.exports = ICalGenerator;