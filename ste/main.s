; STE Spectrum 4096 sprite experiment. vasm Motorola syntax, 68000 only.
; Moving masked ball. SPACE pauses/resumes; Q toggles palette rebuilding;
; ESC restores the desktop. Default fast mode uses the background palette.
; draw_begin accepts ball_x=0..288 and ball_y=1..168 (row zero is SPU sync).
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
        move.w  #4,-(sp)
        trap    #14
        addq.l  #2,sp
        move.w  d0,old_resolution
        cmpi.w  #2,d0
        beq     exit_program        ; no monochrome monitor
        pea     check_ste
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
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
        lea     screen_storage,a0
        move.l  a0,d0
        addi.l  #255,d0
        andi.l  #$ffffff00,d0
        move.l  d0,front_screen
        addi.l  #32000,d0
        move.l  d0,back_screen
        lea     background_palettes,a0
        lea     sprite_palettes,a1
        lea     second_palettes,a2
        move.w  #(201*96/4)-1,d7
.palettes:
        move.l  (a0)+,d0
        move.l  d0,(a1)+
        move.l  d0,(a2)+
        dbf     d7,.palettes
        move.l  #sprite_palettes,back_palettes
        move.l  #second_palettes,front_palettes
        pea     save_hardware
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        clr.w   -(sp)
        move.l  front_screen,-(sp)
        move.l  front_screen,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        ; Setscreen clears the new physical screen on a resolution change.
        lea     background_screen,a0
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
        pea     install_display
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp

        ; Keep display active during computation. Markers support Hatari cycles.
draw_begin:
        bsr     ensure_palette_mode
        bsr     restore_back_rows
        tst.w   quality_mode
        bne.s   .quality
        bsr     fast_sprite
        bra.s   draw_done
.quality:
        bsr     prepare_source
composite_done:
        bsr     rebuild_sprite_rows
draw_done:
        move.w  ball_y,back_old_y
        move.w  #1,pending_view
.wait_present:
        tst.w   pending_view
        bpl.s   .wait_present
sprite_visible:
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
        andi.b  #$df,d0
        cmpi.b  #'Q',d0
        bne.s   .space
        eori.w  #1,quality_mode
        bra.s   .advance
.space:
        cmpi.b  #' ',d0
        bne.s   .advance
        eori.w  #1,paused
.advance:
        tst.w   paused
        bne.s   sprite_visible
        bsr     move_ball
        bra     draw_begin
quit_demo:
        pea     remove_display
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        move.w  old_resolution,-(sp)
        move.l  old_physbase,-(sp)
        move.l  old_logbase,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        pea     restore_hardware
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        pea     mouse_on
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
exit_program:
        clr.w   -(sp)
        trap    #1

move_ball:
        move.w  velocity_x,d0
        add.w   d0,ball_x
        cmpi.w  #288,ball_x
        bls.s   .y
        neg.w   velocity_x
        sub.w   d0,ball_x
        move.w  velocity_x,d0
        add.w   d0,ball_x
.y:
        move.w  velocity_y,d0
        add.w   d0,ball_y
        cmpi.w  #1,ball_y
        blt.s   .bounce_y
        cmpi.w  #168,ball_y
        ble.s   .done
.bounce_y:
        neg.w   velocity_y
        sub.w   d0,ball_y
        move.w  velocity_y,d0
        add.w   d0,ball_y
.done:
        rts

; The quality path changes the active 48-entry palette stream for the
; sprite rows.  Before returning to the fixed-palette fast path, restore
; both double-buffered palette streams from the immutable background copy.
ensure_palette_mode:
        tst.w   quality_mode
        bne.s   .quality
        tst.w   palette_mode
        beq.s   .done
        lea     background_palettes,a0
        move.l  back_palettes,a1
        move.l  front_palettes,a2
        move.w  #(201*96/4)-1,d7
.reset:
        move.l  (a0)+,d0
        move.l  d0,(a1)+
        move.l  d0,(a2)+
        dbf     d7,.reset
        clr.w   palette_mode
.done:
        rts
.quality:
        move.w  #1,palette_mode
        rts

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
        move.l  #background_palettes,display_palettes_pointer
        move.w  #-1,pending_view
        move.l  $456.w,a0            ; TOS VBL queue, not the interrupt vector
        move.l  a0,vbl_queue
        move.l  (a0),old_vbl
        move.l  #spectrum_vbl,(a0)
        move.w  (sp)+,sr
        rts

remove_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        move.l  vbl_queue,a0
        move.l  old_vbl,(a0)
        move.w  (sp)+,sr
        rts

        include "quantize.s"
        include "fast.s"
        include "raster.s"

        data
        even
mouse_off: dc.b 18
mouse_on:  dc.b 8
        even
pending_view: dc.w -1
shown_view: dc.w 0
ball_x: dc.w 144
ball_y: dc.w 84
velocity_x: dc.w 3
velocity_y: dc.w 2
paused: dc.w 0
quality_mode: dc.w 0
palette_mode: dc.w 0
front_old_y: dc.w -1
back_old_y: dc.w -1
        include "tables.s"
background_screen: incbin "assets/background-screen.bin"
background_palettes: incbin "assets/background-palettes.bin"
        dcb.w 96,0                 ; slide.s reads two trailing palette rows
source_rgb: incbin "assets/source.bin"
sprite_rgb: incbin "assets/sprite.bin"
sprite_rgb_odd: incbin "assets/sprite-odd.bin"
sprite_mask: incbin "assets/mask.bin"
background_checkpoints: incbin "assets/checkpoints.bin"
sprite_codes: incbin "assets/sprite-codes.bin"
sprite_codes_odd: incbin "assets/sprite-codes-odd.bin"
segment_offsets: incbin "assets/segment-offsets.bin"
fast_map: incbin "assets/fast-map.bin"
        even

        bss
old_resolution: ds.w 1
old_sync: ds.b 1
old_base_low: ds.b 1
old_line_width: ds.b 1
old_scroll: ds.b 1
        even
old_physbase: ds.l 1
old_logbase: ds.l 1
front_screen: ds.l 1
back_screen: ds.l 1
front_palettes: ds.l 1
back_palettes: ds.l 1
vbl_queue: ds.l 1
old_vbl: ds.l 1
old_palette: ds.w 16
display_palettes_pointer: ds.l 1
vbl_counter: ds.l 1
line_source: ds.l 1
remap_source: ds.l 1
next_event: ds.l 1
current_x: ds.w 1
current_y: ds.w 1
start_x: ds.w 1
fast_screen_row: ds.l 1
pixel_bit: ds.w 1
dirty_pairs: ds.w 1
best_cost: ds.l 1
best_a: ds.w 1
best_b: ds.w 1
slots: ds.b 48*16
incoming: ds.b 16
active: ds.l 16
pair_costs: ds.l 16*16
sprite_palettes: ds.w 201*48
second_palettes: ds.w 201*48
work_image: ds.w 32*320
screen_storage: ds.b 64000+255
        even
        ds.l 1024
stack_top:
        end
