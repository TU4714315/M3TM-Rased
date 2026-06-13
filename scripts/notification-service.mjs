export class DashboardNotificationService {
  constructor(database) {
    this.database = database;
  }

  async send(alert) {
    return this.database.collection('alerts').add(alert);
  }
}

export class ExternalNotificationService {
  async send(alert) {
    void alert;
    return { delivered: false, reason: 'External notification channel is not configured.' };
  }
}
