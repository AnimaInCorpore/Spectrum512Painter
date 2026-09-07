; Palette-preserving path: every opaque sprite pixel gets its exact closest
; accessible background color under the same fixed-point Oklab distance.
; Offline map indexed by screen row, one of 33 access bands, and sprite color.
; This cache is valid ONLY for the immutable background palettes.
fast_sprite:
        lea     sprite_codes,a0
        move.w  ball_x,d0
        add.w   ball_y,d0
        btst    #0,d0
        beq.s   .even
        lea     sprite_codes_odd,a0
.even:
        lea     sprite_mask,a1
        move.w  ball_y,d0
        mulu.w  #2112,d0
        lea     fast_map,a5
        adda.l  d0,a5
        move.w  ball_y,d0
        mulu.w  #160,d0
        move.l  back_screen,a6
        adda.l  d0,a6
        move.w  ball_x,d0
        lsr.w   #4,d0
        lsl.w   #3,d0
        adda.w  d0,a6
        move.l  a6,fast_screen_row
        moveq   #31,d7
.row:
        move.l  fast_screen_row,a6
        move.w  ball_x,d0
        andi.w  #15,d0
        move.w  #$8000,d4
        lsr.w   d0,d4
        move.w  ball_x,d0
        add.w   d0,d0
        lea     segment_offsets,a4
        adda.w  d0,a4
        move.l  (a1)+,d5
        moveq   #31,d6
.pixel:
        moveq   #0,d0
        move.b  (a0)+,d0
        move.w  (a4)+,d1
        add.l   d5,d5
        bcc.s   .next
        add.w   d0,d1
        move.b  0(a5,d1.w),d0
        move.w  d4,d2
        not.w   d2
        and.w   d2,(a6)
        and.w   d2,2(a6)
        and.w   d2,4(a6)
        and.w   d2,6(a6)
        btst    #0,d0
        beq.s   .p1
        or.w    d4,(a6)
.p1:
        btst    #1,d0
        beq.s   .p2
        or.w    d4,2(a6)
.p2:
        btst    #2,d0
        beq.s   .p3
        or.w    d4,4(a6)
.p3:
        btst    #3,d0
        beq.s   .next
        or.w    d4,6(a6)
.next:
        lsr.w   #1,d4
        bne.s   .same_group
        move.w  #$8000,d4
        addq.l  #8,a6
.same_group:
        dbf     d6,.pixel
        addi.l  #160,fast_screen_row
        adda.w  #2112,a5
        dbf     d7,.row
        rts
