; Spectrum 512 picture (SPACE.TGA) with a 32x32 ball of 6 colors, drawn by the Blitter with the routines of the
; stefastbobs2 sprite compiler (assets/blit-ball.s). STE, 60 Hz, vasm Motorola syntax, 68000 only.
; The ball uses registers 10-15, which hold its colors in all three palette entries of its lines.
; BAND=1: the picture uses all 16 registers; only the 32 lines of the ball show the version of the picture that
;         uses registers 0-9, and these lines move with the ball.
; BAND=0: the version with registers 0-9 everywhere, the palettes never change. BALLS balls (up to 12), all with
;         the same colors.
; FRAME_VBLS: a new picture every this many VBLs (1: 60 fps, 3: 20 fps).
; Build and check with node tools/emulate-blit.mjs. SPACE pauses, ESC exits.

	ifnd BAND
BAND equ 1
	endc
	ifnd SPEED_X
SPEED_X equ 2
	endc
	ifnd SPEED_Y
SPEED_Y equ 1
	endc
	ifnd BALLS
BALLS equ 1
	endc
	ifnd FRAME_VBLS
FRAME_VBLS equ 1
	endc
	ifne BAND
	ifne BALLS-1
	fail "the band variant has one ball"
	endc
	endc

VIRTUAL_DISPLAY_WIDTH = 320
BUSY = %10000000
HOG = %01000000
FXSR = %10000000
NFSR = %01000000

        text
start:
        move.l  sp,a5
        lea     stack_top,sp
        move.l  4(a5),a5
        move.l  $c(a5),d0
        add.l   $14(a5),d0
        add.l   $1c(a5),d0
        addi.l  #$100,d0
        move.l  d0,-(sp)
        move.l  a5,-(sp)
        clr.w   -(sp)
        move.w  #$4a,-(sp)
        trap    #1
        lea     12(sp),sp
        clr.l   -(sp)                ; the Blitter registers need supervisor mode
        move.w  #$20,-(sp)
        trap    #1
        addq.l  #6,sp
        move.w  #4,-(sp)
        trap    #14
        addq.l  #2,sp
        move.w  d0,old_resolution
        cmpi.w  #2,d0
        beq     exit_program         ; no monochrome monitor
        bsr     check_ste
        tst.w   d0
        beq     exit_program
        move.w  #2,-(sp)
        trap    #14
        addq.l  #2,sp
        move.l  d0,old_physbase
        move.w  #3,-(sp)
        trap    #14
        addq.l  #2,sp
        move.l  d0,old_logbase

        ; Both screens in one 64 KB page: the ball routines only write the low word of the destination address.
        move.l  #screen_storage+65535,d0
        clr.w   d0
        move.l  d0,front_screen
        move.l  d0,screen_0
        addi.l  #32768,d0
        move.l  d0,back_screen
        lea     picture_palettes,a0
        lea     palettes_0,a1
        lea     palettes_1,a2
        move.w  #199*96/4-1,d7
.palettes:
        move.l  (a0)+,d0
        move.l  d0,(a1)+
        move.l  d0,(a2)+
        dbf     d7,.palettes
        move.l  #palettes_0,front_palettes
        move.l  #palettes_1,back_palettes
        bsr     save_hardware
        clr.w   -(sp)
        move.l  front_screen,-(sp)
        move.l  front_screen,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        lea     picture_screen,a0    ; Setscreen clears the new physical screen on a resolution change
        move.l  front_screen,a1
        move.l  back_screen,a2
        move.w  #7999,d7
.copy:
        move.l  (a0)+,d0
        move.l  d0,(a1)+
        move.l  d0,(a2)+
        dbf     d7,.copy
        pea     mouse_off
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
        bsr     install_display

; One frame: draw into the back buffer, let the VBL show it, move the balls.
draw_begin:
        lea     buffer_0,a6          ; where this buffer had the balls
        move.l  back_screen,d0
        cmp.l   screen_0,d0
        beq.s   .buffer
        lea     buffer_1,a6
.buffer:
        ifne    BAND
        bsr     move_band
        move.w  ball_x,(a6)
        move.w  ball_y,2(a6)
        else
        movea.l a6,a4                ; first all old balls get the picture back, then all new ones are drawn
        rept    BALLS
        bsr     restore_ball
        addq.l  #4,a6
        endr
        lea     balls,a0
        rept    BALLS
        move.l  (a0),(a4)+           ; x and y
        addq.l  #8,a0
        endr
        endc
        bsr     draw_balls
draw_done:
        ifgt    FRAME_VBLS-1
.pace:  ; the screen address goes out in the frame before the one that shows the new picture
        move.l  vbl_counter,d0
        sub.l   presented_vbl,d0
        cmpi.l  #FRAME_VBLS-1,d0
        blt.s   .pace
        endc
        ; The video hardware takes a new screen address at the start of a frame, so it is written here, before the
        ; VBL that shows the new screen: a VBL that writes it shows the screen one frame later than its palettes.
        move.w  sr,-(sp)
        move.w  #$2700,sr
        move.l  back_screen,d0
        move.b  d0,$ffff820d.w
        lsr.l   #8,d0
        move.b  d0,$ffff8203.w
        lsr.l   #8,d0
        move.b  d0,$ffff8201.w
        move.w  #1,pending_view
        move.w  (sp)+,sr
.wait_present:
        tst.w   pending_view
        bpl.s   .wait_present
        move.l  vbl_counter,presented_vbl
        addq.l  #1,frames_drawn
        moveq   #7,d0                ; the keyboard every 8 frames
        and.l   frames_drawn,d0
        bne.s   .advance
.key:
        move.w  #2,-(sp)
        move.w  #1,-(sp)             ; BIOS Bconstat(CON)
        trap    #13
        addq.l  #4,sp
        tst.l   d0
        beq.s   .advance
        move.w  #2,-(sp)
        move.w  #2,-(sp)
        trap    #13
        addq.l  #4,sp
        cmpi.b  #27,d0
        beq.s   quit_demo
        cmpi.b  #' ',d0
        bne.s   .advance
        eori.w  #1,paused
.advance:
        tst.w   paused
        bne.s   .key
        bsr     move_balls
        bra     draw_begin

quit_demo:
        bsr     remove_display
        move.w  old_resolution,-(sp)
        move.l  old_physbase,-(sp)
        move.l  old_logbase,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        bsr     restore_hardware
        pea     mouse_on
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
exit_program:
        clr.w   -(sp)
        trap    #1

move_balls:
        lea     balls,a0             ; x, y, x speed, y speed
        moveq   #BALLS-1,d7
.ball:
        move.w  4(a0),d0
        add.w   d0,(a0)
        cmpi.w  #288,(a0)
        bls.s   .y
        neg.w   4(a0)
        sub.w   d0,(a0)
        sub.w   d0,(a0)
.y:
        move.w  6(a0),d0
        add.w   d0,2(a0)
        cmpi.w  #1,2(a0)
        blt.s   .bounce_y
        cmpi.w  #168,2(a0)
        ble.s   .next
.bounce_y:
        neg.w   6(a0)
        sub.w   d0,2(a0)
        sub.w   d0,2(a0)
.next:
        addq.l  #8,a0
        dbf     d7,.ball
        rts

; Blitter block copy, HOP 2 / OP 3, no skew, all endmasks $ffff: a0 source, a1 destination, d0 words per line,
; d1 lines, d2 bytes from the end of a line to the start of the next one (source and destination alike).
blit_copy:
        move.w  #2,$ffff8a20.w       ; source X increment
        move.w  d2,$ffff8a22.w       ; source Y increment
        move.l  a0,$ffff8a24.w
        moveq   #-1,d3
        move.w  d3,$ffff8a28.w       ; endmasks 1-3
        move.l  d3,$ffff8a2a.w
        move.w  #2,$ffff8a2e.w       ; destination X increment
        move.w  d2,$ffff8a30.w       ; destination Y increment
        move.l  a1,$ffff8a32.w
        move.w  d0,$ffff8a36.w       ; X count
        move.w  d1,$ffff8a38.w       ; Y count
        move.w  #$0203,$ffff8a3a.w   ; HOP 2, OP 3
        move.w  #(BUSY+HOG)<<8,$ffff8a3c.w ; start, no FXSR/NFSR/skew
        nop
        rts

; The rectangle of the old ball (a6: x, y; y < 0: none) gets the picture back, d4 to d5 (exclusive) of its lines.
restore_rows:
        cmp.w   d5,d4
        bge.s   .done
        move.w  (a6),d0
        moveq   #-16,d6
        and.w   d0,d6
        lsr.w   #1,d6                ; byte offset of the first 16 pixel group
        moveq   #12,d7               ; 3 groups of 4 plane words, 2 when the ball starts on a group
        andi.w  #15,d0
        bne.s   .groups
        moveq   #8,d7
.groups:
        move.w  d4,d1
        mulu.w  #160,d1
        add.w   d6,d1
        lea     restore_screen,a0
        adda.l  d1,a0
        move.l  back_screen,a1
        adda.l  d1,a1
        move.w  d7,d0
        move.w  d5,d1
        sub.w   d4,d1
        move.w  #160+2,d2
        sub.w   d7,d2
        sub.w   d7,d2
        bsr     blit_copy
.done:
        rts

; Lines d4 to d5 (exclusive) of the screen and their palettes get the lines of a picture version:
; a2 its screen, a3 its palettes.
copy_lines:
        cmp.w   d5,d4
        bge.s   .done
        move.w  d4,d1
        mulu.w  #160,d1
        lea     (a2,d1.l),a0
        move.l  back_screen,a1
        adda.l  d1,a1
        moveq   #80,d0
        move.w  d5,d1
        sub.w   d4,d1
        moveq   #2,d2
        bsr     blit_copy
        move.w  d4,d1
        subq.w  #1,d1                ; the palettes start with line 1
        mulu.w  #96,d1
        lea     (a3,d1.l),a0
        move.l  back_palettes,a1
        adda.l  d1,a1
        moveq   #48,d0
        move.w  d5,d1
        sub.w   d4,d1
        moveq   #2,d2
        bsr     blit_copy
.done:
        rts

        ifne    BAND
; The lines of the old ball (a6) that the new one leaves get the full picture back, the lines that the new one
; enters the version with registers 0-9, and the lines of both get the picture back under the old ball.
move_band:
        move.w  2(a6),d4             ; old first line, -1: none
        bmi     .enter_all
        move.w  ball_y,d5
        move.w  d5,d6
        sub.w   d4,d6                ; new - old
        beq     .same
        bpl.s   .down
        ; up: old lines new+32 .. old+32 leave, new .. old enter
        move.w  ball_y,d4
        addi.w  #32,d4
        move.w  2(a6),d5
        addi.w  #32,d5
        cmp.w   2(a6),d4
        bge.s   .up_leave
        move.w  2(a6),d4
.up_leave:
        lea     full_screen,a2
        lea     full_palettes,a3
        bsr     copy_lines
        move.w  ball_y,d4
        move.w  2(a6),d5
        move.w  ball_y,d0
        addi.w  #32,d0
        cmp.w   d0,d5
        ble.s   .up_enter
        move.w  d0,d5
.up_enter:
        lea     limited_screen,a2
        lea     limited_palettes,a3
        bsr     copy_lines
        move.w  2(a6),d4             ; both: old .. new+32
        move.w  ball_y,d5
        addi.w  #32,d5
        bra.s   .restore
.down:  ; old .. new leave, old+32 .. new+32 enter
        move.w  2(a6),d4
        move.w  ball_y,d5
        move.w  d4,d0
        addi.w  #32,d0
        cmp.w   d0,d5
        ble.s   .down_leave
        move.w  d0,d5
.down_leave:
        lea     full_screen,a2
        lea     full_palettes,a3
        bsr     copy_lines
        move.w  2(a6),d4
        addi.w  #32,d4
        move.w  ball_y,d0
        cmp.w   d0,d4
        bge.s   .down_enter
        move.w  d0,d4
.down_enter:
        move.w  ball_y,d5
        addi.w  #32,d5
        lea     limited_screen,a2
        lea     limited_palettes,a3
        bsr     copy_lines
        move.w  ball_y,d4            ; both: new .. old+32
        move.w  2(a6),d5
        addi.w  #32,d5
        bra.s   .restore
.same:
        move.w  d4,d5
        addi.w  #32,d5
.restore:
        bra     restore_rows
.enter_all:
        move.w  ball_y,d4
        move.w  d4,d5
        addi.w  #32,d5
        lea     limited_screen,a2
        lea     limited_palettes,a3
        bra     copy_lines
        else
restore_ball:
        move.w  2(a6),d4
        bmi.s   .done
        move.w  d4,d5
        addi.w  #32,d5
        bra     restore_rows
.done:
        rts
        endc

; The balls into the back screen, each with its routine for the pixel shift (fastbobs register setup). The routines
; run as a chain, the last pushed first, so ball 0 ends up in front.
draw_balls:
        lea     balls,a0
        lea     ball_addresses,a2
        move.w  back_screen+2,d4
        moveq   #BALLS-1,d7
.push:
        move.w  (a0),d0
        move.w  2(a0),d1
        moveq   #15,d2
        and.w   d0,d2
        lsl.w   #2,d2
        moveq   #-16,d3
        and.w   d0,d3
        lsr.w   #1,d3
        mulu.w  #160,d1
        add.w   d1,d3
        add.w   d4,d3
        move.w  d3,-(sp)             ; destination address (low word)
        move.l  (a2,d2.w),-(sp)      ; the routine of the shift
        addq.l  #8,a0
        dbf     d7,.push
        move.b  #2,$ffff8a3a.w       ; HOP 2
        move.b  #3,$ffff8a3b.w       ; OP 3
        move.w  #2,$ffff8a20.w       ; source X increment
        move.w  #2,$ffff8a22.w       ; source Y increment
        move.w  #16/2,$ffff8a2e.w    ; destination X increment
        move.w  #$ffff,$ffff8a2a.w   ; endmask 2
        move.w  back_screen,$ffff8a32.w ; destination address (high word)
        move.w  #-16*(2-1)/2+2,d0
        move.w  #-16*(3-1)/2+2,d1
        move.l  #(2<<16)+4,d2
        move.l  #(3<<16)+4,d3
        move.w  #VIRTUAL_DISPLAY_WIDTH/2-8,d4
        move.w  #-VIRTUAL_DISPLAY_WIDTH/2-8,d5
        move.l  #(1<<16)+4,d6
        moveq   #$ffffffc0,d7
        lea     $ffff8a30.w,a1
        lea     $ffff8a28.w,a2
        lea     $ffff8a2c.w,a3
        lea     $ffff8a32+2.w,a4
        lea     $ffff8a38.w,a5
        lea     $ffff8a3c.w,a6
        rts                          ; into the first routine; the last one returns to the caller of draw_balls

check_ste:
        move.l  $5a0.w,d0
        beq.s   .no
        move.l  d0,a0
.cookie:
        move.l  (a0)+,d0
        beq.s   .no
        move.l  (a0)+,d1
        cmpi.l  #'_MCH',d0
        bne.s   .cookie
        swap    d1
        cmpi.w  #1,d1
        bne.s   .no
        moveq   #1,d0
        rts
.no:
        moveq   #0,d0
        rts

save_hardware:
        move.b  $ffff820a.w,old_sync
        move.b  $ffff820d.w,old_base_low
        move.b  $ffff820f.w,old_line_width
        move.b  $ffff8265.w,old_scroll
        lea     $ffff8240.w,a0
        lea     old_palette,a1
        moveq   #7,d0
.pal:
        move.l  (a0)+,(a1)+
        dbf     d0,.pal
        rts

restore_hardware:
        move.b  old_sync,$ffff820a.w
        move.b  old_base_low,$ffff820d.w
        move.b  old_line_width,$ffff820f.w
        move.b  old_scroll,$ffff8265.w
        lea     old_palette,a0
        lea     $ffff8240.w,a1
        moveq   #7,d0
.pal:
        move.l  (a0)+,(a1)+
        dbf     d0,.pal
        rts

install_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        clr.b   $ffff820a.w          ; 60 Hz: required by slide.s raster timings
        clr.b   $ffff820d.w
        clr.b   $ffff820f.w
        clr.b   $ffff8265.w
        move.l  front_palettes,display_palettes_pointer
        move.w  #-1,pending_view
        move.l  $70.w,old_vbl        ; the VBL swaps the buffers and starts timer A,
        move.l  #spectrum_vbl,$70.w
        move.l  $134.w,old_timer_a   ; whose interrupt runs the palette writes of the picture
        move.l  #spectrum_raster,$134.w
        move.b  $fffffa07.w,old_iera
        move.b  $fffffa13.w,old_imra
        move.b  $fffffa09.w,old_ierb
        clr.b   $fffffa19.w
        bset    #5,$fffffa07.w
        bset    #5,$fffffa13.w
        bclr    #5,$fffffa09.w       ; no 200 Hz timer C (the keyboard runs on the ACIA interrupt)
        move.w  (sp)+,sr
        rts

remove_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        clr.b   $fffffa19.w
        move.b  old_iera,$fffffa07.w
        move.b  old_imra,$fffffa13.w
        move.b  old_ierb,$fffffa09.w
        move.l  old_timer_a,$134.w
        move.l  old_vbl,$70.w
        move.w  (sp)+,sr
        rts

        include "blit-raster.s"
        even
        include "assets/blit-ball.s"

        data
        even
mouse_off: dc.b 18
mouse_on:  dc.b 8
        even
pending_view: dc.w -1
balls:                               ; x, y, x speed, y speed; the first BALLS are used
        dc.w    144,84,SPEED_X,SPEED_Y
        dc.w    20,10,3,2
        dc.w    250,150,-2,1
        dc.w    60,120,1,-2
        dc.w    200,30,-3,-1
        dc.w    100,60,2,2
        dc.w    280,100,-1,2
        dc.w    10,160,3,-1
        dc.w    170,140,-2,-2
        dc.w    40,40,1,1
        dc.w    230,70,-1,-1
        dc.w    120,5,2,1
ball_x = balls
ball_y = balls+2
paused: dc.w 0
buffer_0:                            ; x and first line of every ball in this buffer, -1: none
        rept    BALLS
        dc.w    0,-1
        endr
buffer_1:
        rept    BALLS
        dc.w    0,-1
        endr
full_screen: incbin "assets/blit-full-screen.bin"
full_palettes: incbin "assets/blit-full-palettes.bin"
limited_screen: incbin "assets/blit-limited-screen.bin"
limited_palettes: incbin "assets/blit-limited-palettes.bin"
        ifne    BAND
picture_screen = full_screen
picture_palettes = full_palettes
        else
picture_screen = limited_screen
picture_palettes = limited_palettes
        endc
restore_screen = limited_screen      ; under the ball there is always the version with registers 0-9
        even

        bss
old_resolution: ds.w 1
old_sync: ds.b 1
old_base_low: ds.b 1
old_line_width: ds.b 1
old_scroll: ds.b 1
old_ierb: ds.b 1
old_iera: ds.b 1
old_imra: ds.b 1
        even
old_timer_a: ds.l 1
        even
old_physbase: ds.l 1
old_logbase: ds.l 1
screen_0: ds.l 1
front_screen: ds.l 1
back_screen: ds.l 1
front_palettes: ds.l 1
back_palettes: ds.l 1
old_vbl: ds.l 1
old_palette: ds.w 16
display_palettes_pointer: ds.l 1
vbl_counter: ds.l 1
frames_drawn: ds.l 1
presented_vbl: ds.l 1
palettes_0: ds.w 201*48             ; raster.s reads two rows behind the 199 lines
palettes_1: ds.w 201*48
screen_storage: ds.b 65536+65535
        even
        ds.l 1024
stack_top:
        end
