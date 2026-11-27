# Spec Delta

## Purpose
Tells the user what is around them when the optional cloud service can be used.

## ADDED Requirements

### Requirement: Describe surroundings
With cloud assistance enabled and reachable, the system SHALL describe the room from the camera and answer follow-up questions about it.

#### Scenario: Room and follow-up
- **WHEN** the user asks "What's around me?" and then "Where is the door?"
- **THEN** the system describes the room and then answers about the door

### Requirement: Offline surroundings response
When offline, the system SHALL say "I can't describe surroundings offline." instead of describing the room. A disabled or unavailable cloud service is treated the same way.

#### Scenario: Offline
- **WHEN** the user asks "What's around me?" while offline, or with cloud assistance disabled or unavailable
- **THEN** the system says "I can't describe surroundings offline."
