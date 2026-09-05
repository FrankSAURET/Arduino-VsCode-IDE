#line 1 "C:\\- VS Code\\Extensions\\Arduino-VsCode-IDE\\test\\resources\\blink\\blink.ino"
#include "Arduino.h"

#line 3 "C:\\- VS Code\\Extensions\\Arduino-VsCode-IDE\\test\\resources\\blink\\blink.ino"
void setup();
#line 9 "C:\\- VS Code\\Extensions\\Arduino-VsCode-IDE\\test\\resources\\blink\\blink.ino"
void loop();
#line 3 "C:\\- VS Code\\Extensions\\Arduino-VsCode-IDE\\test\\resources\\blink\\blink.ino"
void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("test");
}

void loop() {
  Serial.println("Hello World");
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
}

