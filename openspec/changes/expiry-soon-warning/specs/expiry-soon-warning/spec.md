# Spec Delta

## Purpose
Tells the user when a medicine is close to its expiry date, and stays quiet when it is not.

## ADDED Requirements

### Requirement: Time left before expiry
The system SHALL classify a medicine with an accepted expiry date, using the device's current date, as expired, expiring within 7 days, expiring within one month, or expiring later. An expiry date with no day SHALL stay valid through the last day of its month. "Within one month" SHALL mean on or before the same day of the next month, or the last day of the next month if that day does not exist.

#### Scenario: Last valid day
- **WHEN** today is the last valid day of the medicine
- **THEN** it is classified as within 7 days, not as expired

#### Scenario: Day after expiry
- **WHEN** today is the day after the last valid day
- **THEN** it is classified as expired

#### Scenario: Seven days left
- **WHEN** today is 10 March 2027 and the expiry date is 17 March 2027
- **THEN** it is classified as within 7 days

#### Scenario: Eight days left
- **WHEN** today is 10 March 2027 and the expiry date is 18 March 2027
- **THEN** it is classified as within one month

#### Scenario: One month boundary
- **WHEN** today is 10 March 2027 and the expiry date is 10 April 2027
- **THEN** it is classified as within one month

#### Scenario: Past one month
- **WHEN** today is 10 March 2027 and the expiry date is 11 April 2027
- **THEN** it is classified as later

#### Scenario: Shorter next month
- **WHEN** today is 31 January 2027
- **THEN** 28 February 2027 is within one month and 1 March 2027 is later

#### Scenario: Month and year only
- **WHEN** today is 28 March 2027 and the label shows an expiry of March 2027
- **THEN** the last valid day is 31 March 2027 and it is classified as within 7 days

### Requirement: Expiry-soon notice
Every answer about a medicine that expires within one month SHALL state this before other medicine details, in the reply language, using the 7-day notice or the one-month notice but not both. The system SHALL NOT give an expiry-soon notice when more than one month is left, when the medicine has expired, or when no expiry date is accepted.

#### Scenario: Within 7 days
- **WHEN** the user asks about a medicine that expires within 7 days
- **THEN** the answer begins with the 7-day notice only

#### Scenario: Within one month
- **WHEN** the user asks about a medicine that expires in more than 7 days but within one month
- **THEN** the answer begins with the one-month notice only

#### Scenario: More than one month
- **WHEN** the medicine expires more than one month from today
- **THEN** no expiry-soon notice is given

#### Scenario: Already expired
- **WHEN** the medicine has expired
- **THEN** no expiry-soon notice is added, and the expired-medicine rules apply

#### Scenario: Expiry not accepted
- **WHEN** no expiry date is accepted from the label
- **THEN** no expiry-soon notice is given and the answer does not suggest that the medicine is in date
