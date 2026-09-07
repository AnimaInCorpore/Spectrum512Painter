; Offline-generated tables. All words and longs are big endian.
switch_events:
        dc.w 1,0
        dc.w 5,1
        dc.w 21,2
        dc.w 25,3
        dc.w 41,4
        dc.w 45,5
        dc.w 61,6
        dc.w 65,7
        dc.w 81,8
        dc.w 85,9
        dc.w 101,10
        dc.w 105,11
        dc.w 121,12
        dc.w 125,13
        dc.w 141,14
        dc.w 145,15
        dc.w 161,0
        dc.w 165,1
        dc.w 181,2
        dc.w 185,3
        dc.w 201,4
        dc.w 205,5
        dc.w 221,6
        dc.w 225,7
        dc.w 241,8
        dc.w 245,9
        dc.w 261,10
        dc.w 265,11
        dc.w 281,12
        dc.w 285,13
        dc.w 301,14
        dc.w 305,15
        dc.w 32767,0
oklab_table: incbin "assets/oklab.bin"
square_table: incbin "assets/squares.bin"
ste_colors: incbin "assets/ste-colors.bin"
weight_rows: incbin "assets/weight-rows.bin"
weight_table: incbin "assets/weights.bin"
        even

