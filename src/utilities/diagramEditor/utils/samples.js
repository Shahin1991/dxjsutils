export const SAMPLES = {
  Flowchart: `flowchart LR
  A[Booking] --> B{Paid?}
  B -- Yes --> C[Issue ticket]
  B -- No --> D[Send reminder]
  D --> B
  C --> E((Check-in))`,
  Sequence: `sequenceDiagram
  participant App
  participant API
  participant DB
  App->>API: POST /bookings
  API->>DB: INSERT booking
  DB-->>API: id 42
  API-->>App: 201 Created`,
  Gantt: `gantt
  title Release plan
  dateFormat YYYY-MM-DD
  section Build
  Design      :a1, 2026-11-02, 5d
  Development :a2, after a1, 10d
  section Ship
  Testing     :after a2, 5d
  Go live     :milestone, 2026-12-01, 0d`,
  Class: `classDiagram
  class Flight {
    +String number
    +Date departure
    +board(Passenger p)
  }
  class Passenger {
    +String name
    +String seat
  }
  Flight "1" --> "*" Passenger : carries`,
  State: `stateDiagram-v2
  [*] --> Scheduled
  Scheduled --> Boarding
  Boarding --> Departed
  Scheduled --> Cancelled
  Departed --> [*]`,
  'Entity relationship': `erDiagram
  CUSTOMER ||--o{ BOOKING : makes
  BOOKING ||--|{ SEGMENT : contains
  SEGMENT }o--|| FLIGHT : on`,
  Pie: `pie title Fleet mix
  "A380" : 116
  "777" : 140
  "A350" : 10`,
  Mindmap: `mindmap
  root((Trip))
    Flights
      Outbound
      Return
    Hotel
    Visa`,
  Timeline: `timeline
  title Project
  Q1 : Kick-off : Research
  Q2 : Build
  Q3 : Launch`,
};
